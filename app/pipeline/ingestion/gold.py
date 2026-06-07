"""
Gold stage: load silver chunks → extract entities/relations/intents via LLM →
embed → conflict detect → atomic commit (Postgres + Qdrant + Neo4j).
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

import litellm
from neo4j import AsyncDriver
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    KBConflictBatchInsert,
    KBConflictInsert,
    KBLifecycleHistoryInsert,
    KBTextBlockInsert,
    KBTextBlockVersionInsert,
    KBTextTableInsert,
    Tier,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import (
    KBDataORM,
    KBTextBlockORM,
    KBTextBlockVersionORM,
    KBTextTableORM,
)
from basemodel.services_databaseconnector.qdrant_model import (
    AddPointsRequest,
    MatchingPayload,
    MatchType,
    PointData,
    PointPayload,
    SearchRequest,
)
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.qdrant_connector import (
    add_points as qdrant_add_points,
    vector_search as qdrant_vector_search,
)
from app.pipeline.ingestion import config as cfg

log = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


# ── LLM helpers ───────────────────────────────────────────────────────────────
# litellm.atext_completion → /v1/completions → LiteLLM proxy → /api/generate on llama.
# X-System-Type in extra_headers is forwarded to the llama server so it loads the
# pre-cached system KV snapshot; only the user content is tokenized per call.

async def _llm_generate_json(system_type: str, user: str, max_tokens: int = 1024) -> dict:
    resp = await litellm.atext_completion(
        model=cfg.LLM_MODEL,
        prompt=user,
        api_base=cfg.LITELLM_BASE_URL,
        extra_headers={"X-System-Type": system_type},
        temperature=0.1,
        max_tokens=max_tokens,
    )
    raw = resp.choices[0].text
    m = _JSON_FENCE.search(raw)
    cleaned = m.group(1).strip() if m else raw.strip()
    return json.loads(cleaned)


async def _embed(text: str) -> list[float]:
    resp = await litellm.aembedding(
        model=cfg.EMBEDDING_MODEL,
        input=[text],
        api_base=cfg.LITELLM_BASE_URL,
    )
    return resp.data[0].embedding


# ── Extraction ────────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = """\
You are a knowledge extraction assistant. Given a text chunk, extract:
- summary: one concise sentence summarising the chunk
- entities: list of key named entities (people, places, orgs, concepts, metrics)
- relationships: list of {from, to, type, description} objects describing entity relationships
- intents: list of the primary intents or topics covered (2-5 short phrases)

Reply ONLY with valid JSON:
{
  "summary": "...",
  "entities": ["...", ...],
  "relationships": [{"from": "...", "to": "...", "type": "...", "description": "..."}, ...],
  "intents": ["...", ...]
}"""


async def _extract_chunk(content: str) -> dict[str, Any]:
    result = await _llm_generate_json("extract", content[:3000], max_tokens=1024)
    return {
        "summary": result.get("summary", ""),
        "entities": result.get("entities", []),
        "relationships": result.get("relationships", []),
        "intents": result.get("intents", []),
    }


# ── Conflict detection ────────────────────────────────────────────────────────

_CONFLICT_SYSTEM = """\
You are a knowledge conflict detector. Compare an existing knowledge chunk and an incoming chunk.
Decide if there is a conflict.

Conflict types:
- content_contradiction: the incoming chunk directly contradicts facts in the existing chunk
- content_conflict: both chunks cover the same topic but with incompatible claims
- content_duplicate: the incoming chunk is largely the same as the existing chunk
- content_update: the incoming chunk is a newer version of existing information

Reply ONLY with valid JSON:
{
  "has_conflict": true/false,
  "conflict_type": "content_contradiction|content_conflict|content_duplicate|content_update",
  "severity": "low|medium|high",
  "explanation": "..."
}"""


async def _detect_conflict(existing_summary: str, incoming_summary: str) -> dict:
    user = (
        f"Existing chunk summary:\n{existing_summary}\n\n"
        f"Incoming chunk summary:\n{incoming_summary}"
    )
    return await _llm_generate_json("conflict", user, max_tokens=256)


SYSTEM_PROMPTS: dict[str, str] = {
    "extract":  _EXTRACT_SYSTEM,
    "conflict": _CONFLICT_SYSTEM,
}


# ── Per-chunk atomic commit ───────────────────────────────────────────────────

async def _commit_chunk_to_postgres(
    postgres: PostgresClient,
    data_id: str,
    block_index: int,
    content: str,
    table_involved: bool,
    table: dict | None,
    payload: dict,
    approved_by: str,
) -> tuple[str, str]:
    """Insert KBTextBlock + KBTextBlockVersion (+ KBTextTable) atomically. Returns (block_id, version_id)."""
    async with postgres.get_client() as session:
        try:
            block_orm = KBTextBlockORM(owner_id=uuid.UUID(data_id), block_index=block_index)
            session.add(block_orm)
            await session.flush()

            version_orm = KBTextBlockVersionORM(
                block_id=block_orm.block_id,
                version_number=1,
                content=content,
                created_by=approved_by,
                table_involved=table_involved,
                payload=payload,
                is_active=True,
            )
            session.add(version_orm)
            await session.flush()

            if table_involved and table:
                table_orm = KBTextTableORM(
                    version_id=version_orm.version_id,
                    table_name=table.get("table_name", f"table_{block_index}"),
                    description=table.get("description"),
                    data=table.get("data"),
                )
                session.add(table_orm)

            await session.commit()
            return str(block_orm.block_id), str(version_orm.version_id)
        except Exception:
            await session.rollback()
            raise


async def _commit_chunk_to_qdrant(
    qdrant: AsyncQdrantClient,
    tenant_id: str,
    data_id: str,
    block_id: str,
    embedding: list[float],
    summary: str,
    entities: list[str],
    intents: list[str],
) -> None:
    result = await qdrant_add_points(qdrant, AddPointsRequest(
        tenant_id=tenant_id,
        collection_name=cfg.QDRANT_COLLECTION,
        points=[PointData(
            vector=embedding,
            payload=PointPayload(
                tenant_id=tenant_id,
                data_id=uuid.UUID(data_id),
                block_id=uuid.UUID(block_id),
                summary=summary,
                entities=entities,
                intents=intents,
            ),
        )],
    ))
    if result.code != 200:
        raise RuntimeError(f"Qdrant add_points failed: {result.error}")


async def _commit_chunk_to_neo4j(
    neo4j: AsyncDriver,
    tenant_id: str,
    data_id: str,
    block_id: str,
    entities: list[str],
    relationships: list[dict],
) -> None:
    async with neo4j.session() as session:
        for entity in entities:
            await session.run(
                "MERGE (n:Entity {name: $name, tenant_id: $tenant_id}) "
                "SET n.block_id = $block_id, n.data_id = $data_id",
                name=entity, tenant_id=tenant_id,
                block_id=block_id, data_id=data_id,
            )
        for rel in relationships:
            await session.run(
                "MERGE (a:Entity {name: $from_name, tenant_id: $tenant_id}) "
                "MERGE (b:Entity {name: $to_name, tenant_id: $tenant_id}) "
                "MERGE (a)-[r:RELATES {rel_type: $rel_type, tenant_id: $tenant_id}]->(b) "
                "SET r.description = $description, r.block_id = $block_id",
                from_name=rel.get("from", ""),
                to_name=rel.get("to", ""),
                rel_type=rel.get("type", "RELATES"),
                description=rel.get("description", ""),
                tenant_id=tenant_id,
                block_id=block_id,
            )


# ── Main stage function ────────────────────────────────────────────────────────

async def promote_to_gold(
    postgres: PostgresClient,
    qdrant: AsyncQdrantClient,
    neo4j: AsyncDriver,
    mongo: MongoClient,
    data_id: str,
    tenant_id: str,
    approved_by: str,
) -> dict:
    """
    Load silver staging chunks → per-chunk: extract, embed, conflict-detect, commit.
    Updates KBData tier to GOLD after all chunks processed.
    Returns: {data_id, committed, conflicted, layer}
    """
    mongo_db = mongo.get_client()
    staging = await mongo_db["kb_silver_staging"].find_one({"data_id": data_id})
    if not staging:
        raise ValueError(f"No silver staging found for data_id={data_id}")

    chunks: list[dict] = staging.get("chunks", [])
    log.info("Gold: processing %d chunks data_id=%s", len(chunks), data_id)

    committed_count = 0
    conflicted_count = 0
    conflict_batch_id: str | None = None

    for chunk in chunks:
        block_index: int = chunk["block_index"]
        content: str = chunk["content"]
        table_involved: bool = chunk.get("table_involved", False)
        table: dict | None = chunk.get("table")

        try:
            # Extract knowledge
            extraction = await _extract_chunk(content)
            summary: str = extraction["summary"]
            entities: list[str] = extraction["entities"]
            relationships: list[dict] = extraction["relationships"]
            intents: list[str] = extraction["intents"]

            # Embed summary
            embedding = await _embed(summary)

            # Conflict detection: search for similar vectors in Qdrant
            search_res = await qdrant_vector_search(qdrant, SearchRequest(
                tenant_id=tenant_id,
                collection_name=cfg.QDRANT_COLLECTION,
                query_vector=embedding,
                limit=5,
            ))

            conflict_found = False
            if search_res.code == 200 and search_res.data:
                for hit in search_res.data:
                    if hit.score < cfg.CONFLICT_SIMILARITY_THRESHOLD:
                        continue
                    existing_summary = (hit.payload or {}).get("summary", "")
                    conflict_result = await _detect_conflict(existing_summary, summary)
                    if conflict_result.get("has_conflict"):
                        # Create batch on first conflict for this data_id
                        if conflict_batch_id is None:
                            batch_res = await postgres.insert(KBConflictBatchInsert(
                                tenant_id=tenant_id,
                                batch_title=f"Conflict batch for data {data_id}",
                                status=ConflictStatus.PENDING,
                            ))
                            if batch_res.code == 200:
                                conflict_batch_id = batch_res.data["batch_id"]

                        raw_type = conflict_result.get("conflict_type", ConflictType.CONTENT_CONFLICT.value)
                        raw_severity = conflict_result.get("severity", ConflictSeverity.MEDIUM.value)

                        await postgres.insert(KBConflictInsert(
                            tenant_id=tenant_id,
                            conflict_type=ConflictType(raw_type),
                            severity=ConflictSeverity(raw_severity),
                            batch_id=conflict_batch_id,
                            status=ConflictStatus.PENDING,
                            detailed_explanation=conflict_result.get("explanation", ""),
                            existing_snapshot={
                                "block_id": str(hit.id),
                                "summary": existing_summary,
                                "entities": (hit.payload or {}).get("entities", []),
                            },
                            incoming_snapshot={
                                "block_index": block_index,
                                "data_id": data_id,
                                "summary": summary,
                                "entities": entities,
                                "content_preview": content[:500],
                            },
                        ))

                        conflict_found = True
                        conflicted_count += 1
                        log.info(
                            "Gold: conflict detected block_index=%d type=%s severity=%s",
                            block_index, raw_type, raw_severity,
                        )
                        break

            if conflict_found:
                continue

            # No conflict — atomic commit across Postgres, Qdrant, Neo4j
            payload_meta = {
                "summary": summary,
                "entities": entities,
                "relationships": relationships,
                "intents": intents,
                "embedding_model": cfg.EMBEDDING_MODEL,
            }

            block_id, version_id = await _commit_chunk_to_postgres(
                postgres, data_id, block_index, content,
                table_involved, table, payload_meta, approved_by,
            )

            await _commit_chunk_to_qdrant(
                qdrant, tenant_id, data_id, block_id,
                embedding, summary, entities, intents,
            )

            await _commit_chunk_to_neo4j(
                neo4j, tenant_id, data_id, block_id,
                entities, relationships,
            )

            committed_count += 1
            log.info("Gold: committed block_index=%d block_id=%s", block_index, block_id)

        except Exception as exc:
            log.error("Gold: chunk failed block_index=%d data_id=%s: %s", block_index, data_id, exc)

    # Update KBData tier to GOLD
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBDataORM)
            .where(KBDataORM.data_id == uuid.UUID(data_id))
            .values(current_tier=Tier.GOLD.value)
        )
        await session.commit()

    await postgres.insert(KBLifecycleHistoryInsert(
        data_id=data_id,
        to_tier=Tier.GOLD,
        from_tier=Tier.SILVER,
        approved_by=approved_by,
        notes=(
            f"Promoted to gold: {committed_count} committed, "
            f"{conflicted_count} conflicts detected"
        ),
    ))

    log.info(
        "Gold complete data_id=%s committed=%d conflicted=%d",
        data_id, committed_count, conflicted_count,
    )
    return {
        "data_id": data_id,
        "committed": committed_count,
        "conflicted": conflicted_count,
        "layer": Tier.GOLD.value,
    }
