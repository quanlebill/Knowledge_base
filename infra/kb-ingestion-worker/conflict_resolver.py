"""
Conflict Resolution Loop
========================
Polls KBConflict for AWAITING records and executes the user-chosen resolution.

Status flow:
  PENDING   — conflict saved during ingestion; user reviews in UI
  AWAITING  — user has set resolution_method (and optionally resolution_instruction);
              the resolver picks it up and executes
  RESOLVED  — action completed; record is archived

Resolution methods:
  keep_existing  — incoming was already skipped; no further action needed
  keep_incoming  — commit the incoming chunk using the stored snapshot
  merge          — LLM-merge existing + incoming content; update existing record
  delete         — soft-delete existing chunk; then commit incoming
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import uuid as _uuid

from neo4j import AsyncDriver
from qdrant_client import models as qmodels
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import select, update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ConflictResolution,
    ConflictStatus,
    ConflictType,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import (
    KBConflictORM,
    KBTextBlockORM,
    KBTextBlockVersionORM,
)
from services.database_connector.model_connector import ModelServiceClient
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.qdrant_connector import QdrantClient as QdrantService
from services.database_connector.neo4j_connector import Neo4jClient

from gold import _commit_chunk_atomic, _neo4j_rollback_chunk
import llama_client
import config as cfg

log = logging.getLogger(__name__)

POLL_INTERVAL = int(cfg.__dict__.get("CONFLICT_POLL_INTERVAL", 30))  # seconds

_MERGE_SYSTEM = """\
You are a knowledge editor. Two text chunks contain related but conflicting information.
Merge them into a single coherent chunk that preserves the most important facts from both.
If a resolution instruction is provided, follow it strictly.
Return only the merged text — no commentary, no headers."""


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_existing_content(
    postgres: PostgresClient,
    block_id: str,
    tenant_id: str,
) -> tuple[str, int] | None:
    """Return (content, version_number) of the active version for block_id, or None."""
    async with postgres.get_client() as session:
        result = await session.execute(
            select(KBTextBlockVersionORM)
            .join(KBTextBlockORM, KBTextBlockVersionORM.block_id == KBTextBlockORM.block_id)
            .where(KBTextBlockORM.block_id == _uuid.UUID(block_id))
            .where(KBTextBlockVersionORM.is_active.is_(True))
            .where(KBTextBlockVersionORM.is_deleted.is_(False))
            .limit(1)
        )
        row = result.scalars().first()
    if row is None:
        return None
    return row.content, row.version_number


async def _mark_resolved(
    postgres: PostgresClient,
    conflict_id: _uuid.UUID,
    resolved_by: str = "system",
) -> None:
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBConflictORM)
            .where(KBConflictORM.conflict_id == conflict_id)
            .values(
                status=ConflictStatus.RESOLVED.value,
                resolved_at=datetime.datetime.now(datetime.timezone.utc),
                resolved_by=resolved_by,
            )
        )
        await session.commit()


async def _rebuild_entity_data(
    snap: dict,
    model: ModelServiceClient,
) -> list[tuple[str, str, list[float]]]:
    """Re-embed entity descriptions from the snapshot to restore entity_data tuples."""
    pairs = snap.get("entity_data", [])
    if not pairs:
        return []
    texts = [e.get("description") or e["name"] for e in pairs]
    vecs  = await model.embed(texts)
    return [(e["name"], e.get("description", ""), v) for e, v in zip(pairs, vecs)]


# ── Resolution handlers ───────────────────────────────────────────────────────

async def _handle_keep_existing(conflict: KBConflictORM, **_) -> None:
    """Incoming was already skipped at ingestion time — nothing to do."""
    log.info("conflict_resolver | keep_existing conflict_id=%s — no-op", conflict.conflict_id)


async def _handle_keep_incoming(
    conflict: KBConflictORM,
    postgres: PostgresClient,
    qdrant_client: AsyncQdrantClient,
    neo4j: AsyncDriver,
    model: ModelServiceClient,
) -> None:
    snap      = conflict.incoming_snapshot or {}
    tenant_id = str(conflict.tenant_id)

    entity_data = await _rebuild_entity_data(snap, model)
    entity_names = [e[0] for e in entity_data]

    await _commit_chunk_atomic(
        postgres=postgres,
        qdrant=qdrant_client,
        neo4j=neo4j,
        tenant_id=tenant_id,
        data_id=snap["data_id"],
        block_index=snap["block_index"],
        content=snap["content"],
        table_involved=snap.get("table_involved", False),
        table=snap.get("table"),
        payload_meta={
            "summary":       snap["summary"],
            "entities":      entity_names,
            "relationships": snap.get("relationships", []),
            "intents":       snap.get("intents", []),
        },
        embedding=snap["embedding"],
        entity_data=entity_data,
        relationships=snap.get("relationships", []),
        intents=snap.get("intents", []),
        summary=snap["summary"],
        approved_by=snap.get("approved_by", "system"),
    )
    log.info("conflict_resolver | keep_incoming committed conflict_id=%s", conflict.conflict_id)


async def _handle_merge(
    conflict: KBConflictORM,
    postgres: PostgresClient,
    qdrant_client: AsyncQdrantClient,
    neo4j: AsyncDriver,
    model: ModelServiceClient,
) -> None:
    existing_snap = conflict.existing_snapshot or {}
    incoming_snap = conflict.incoming_snapshot or {}
    block_id      = existing_snap.get("block_id", "")
    tenant_id     = str(conflict.tenant_id)

    fetched = await _fetch_existing_content(postgres, block_id, tenant_id)
    if fetched is None:
        log.warning("conflict_resolver | merge: existing block_id=%s not found — falling back to keep_incoming", block_id)
        await _handle_keep_incoming(conflict, postgres=postgres, qdrant_client=qdrant_client, neo4j=neo4j, model=model)
        return

    existing_content, current_version = fetched
    incoming_content = incoming_snap.get("content", "")
    instruction      = conflict.resolution_instruction or ""

    user_msg = (
        f"Existing chunk:\n{existing_content}\n\n"
        f"Incoming chunk:\n{incoming_content}"
    )
    if instruction:
        user_msg += f"\n\nResolution instruction: {instruction}"

    merged_content = await llama_client.chat_plain(
        messages=[
            {"role": "system", "content": _MERGE_SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        max_tokens=1024,
        temperature=0.2,
    )

    # Re-embed merged content for the updated Qdrant point
    new_vecs    = await model.embed([merged_content])
    new_embedding = new_vecs[0]

    # Update Qdrant point in-place (same block_id, new vector + summary)
    existing_payload = {
        "tenant_id":  tenant_id,
        "block_id":   block_id,
        "summary":    merged_content[:200],
        "entities":   existing_snap.get("entities", []),
        "intents":    incoming_snap.get("intents", []),
        "is_deleted": False,
    }
    await qdrant_client.upsert(
        collection_name=cfg.QDRANT_COLLECTION,
        points=[qmodels.PointStruct(
            id=block_id,
            vector=new_embedding,
            payload=existing_payload,
        )],
    )

    # Create new active Postgres version (deactivate old first)
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBTextBlockVersionORM)
            .where(KBTextBlockVersionORM.block_id == _uuid.UUID(block_id))
            .where(KBTextBlockVersionORM.is_active.is_(True))
            .values(is_active=False)
        )
        new_ver = KBTextBlockVersionORM(
            block_id=_uuid.UUID(block_id),
            version_number=current_version + 1,
            content=merged_content,
            created_by=conflict.resolved_by or "system",
            table_involved=False,
            payload=existing_payload,
            is_active=True,
        )
        session.add(new_ver)
        await session.commit()

    # Add any new relationships from incoming snapshot to Neo4j
    entity_data = await _rebuild_entity_data(incoming_snap, model)
    if entity_data:
        from gold import _neo4j_commit_chunk
        await _neo4j_commit_chunk(
            neo4j, tenant_id,
            incoming_snap.get("data_id", ""),
            block_id,
            entity_data,
            incoming_snap.get("relationships", []),
        )

    log.info("conflict_resolver | merge complete conflict_id=%s block_id=%s v%d→v%d",
             conflict.conflict_id, block_id, current_version, current_version + 1)


async def _handle_delete(
    conflict: KBConflictORM,
    postgres: PostgresClient,
    qdrant_client: AsyncQdrantClient,
    neo4j: AsyncDriver,
    model: ModelServiceClient,
) -> None:
    """Soft-delete the existing chunk, then commit the incoming one."""
    existing_snap = conflict.existing_snapshot or {}
    block_id      = existing_snap.get("block_id", "")
    tenant_id     = str(conflict.tenant_id)

    if block_id:
        # Soft-delete in Qdrant
        await qdrant_client.set_payload(
            collection_name=cfg.QDRANT_COLLECTION,
            payload={"is_deleted": True},
            points=[block_id],
        )
        # Soft-delete in Postgres
        async with postgres.get_client() as session:
            await session.execute(
                sa_update(KBTextBlockORM)
                .where(KBTextBlockORM.block_id == _uuid.UUID(block_id))
                .values(is_deleted=True)
            )
            await session.commit()
        # Remove Neo4j relationships for this block
        await _neo4j_rollback_chunk(neo4j, tenant_id, block_id)
        log.info("conflict_resolver | delete: removed existing block_id=%s", block_id)

    # Commit the incoming chunk in its place
    await _handle_keep_incoming(conflict, postgres=postgres, qdrant_client=qdrant_client, neo4j=neo4j, model=model)


# ── Dispatcher ────────────────────────────────────────────────────────────────

_HANDLERS = {
    ConflictResolution.KEEP_EXISTING.value: _handle_keep_existing,
    ConflictResolution.KEEP_INCOMING.value: _handle_keep_incoming,
    ConflictResolution.MERGE.value:         _handle_merge,
    ConflictResolution.DELETE.value:        _handle_delete,
}


async def _resolve_conflict(
    conflict: KBConflictORM,
    postgres: PostgresClient,
    qdrant_svc: QdrantService,
    neo4j_svc: Neo4jClient,
    model: ModelServiceClient,
) -> None:
    method = conflict.resolution_method
    handler = _HANDLERS.get(method)
    if handler is None:
        log.warning(
            "conflict_resolver | unknown resolution_method=%r conflict_id=%s — skipping",
            method, conflict.conflict_id,
        )
        return

    try:
        await handler(
            conflict,
            postgres=postgres,
            qdrant_client=qdrant_svc.get_client(),
            neo4j=neo4j_svc.get_client(),
            model=model,
        )
        await _mark_resolved(postgres, conflict.conflict_id)
    except Exception as exc:
        log.error(
            "conflict_resolver | resolution failed conflict_id=%s method=%s: %s",
            conflict.conflict_id, method, exc,
        )


# ── Polling loop ──────────────────────────────────────────────────────────────

async def conflict_resolve_loop(
    postgres: PostgresClient,
    qdrant_svc: QdrantService,
    neo4j_svc: Neo4jClient,
    model: ModelServiceClient,
) -> None:
    """Background loop that polls for AWAITING conflicts and resolves them."""
    log.info("conflict_resolver | loop started (poll_interval=%ds)", POLL_INTERVAL)
    while True:
        try:
            async with postgres.get_client() as session:
                result = await session.execute(
                    select(KBConflictORM)
                    .where(KBConflictORM.status == ConflictStatus.AWAITING.value)
                    .where(KBConflictORM.is_deleted.is_(False))
                    .where(KBConflictORM.resolution_method.isnot(None))
                    .order_by(KBConflictORM.detected_at)
                    .limit(50)
                )
                pending = result.scalars().all()

            if pending:
                log.info("conflict_resolver | %d awaiting conflict(s) found", len(pending))
                for conflict in pending:
                    await _resolve_conflict(conflict, postgres, qdrant_svc, neo4j_svc, model)
        except Exception as exc:
            log.error("conflict_resolver | poll error: %s", exc)

        await asyncio.sleep(POLL_INTERVAL)
