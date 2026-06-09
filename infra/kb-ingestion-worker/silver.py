"""
Silver stage: load from MinIO → parse/describe → filter → store chunks to MongoDB.
Doc/web: InlineDoclingParser.  Image: VLM single-shot.  Video: VLM per sampled frame.
"""
from __future__ import annotations

import io
import json
import logging
import re
import uuid

import llama_client
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    KBLifecycleHistoryInsert,
    PolicyFilteringType,
    ReadJoinRequest,
    SourceType,
    Tier,
    WhereFilter,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import KBDataORM
from services.database_connector.kafka_connector import KafkaProducerClient
from services.database_connector.minio_connector import MinIOClient
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.postgres_connector import PostgresClient

import config as cfg  # local worker config
from pipeline_events import PipelineEventEmitter

log = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)

_MODERATE_SYSTEM = (
    "You are a content moderation assistant. "
    "Given a list of policy rules and a text chunk, decide if the chunk violates any rule. "
    'Reply ONLY with valid JSON: {"blocked": true/false, "reason": "..."}.'
)

SYSTEM_PROMPTS: dict[str, str] = {
    "moderate": _MODERATE_SYSTEM,
}


# ── LLM helpers ───────────────────────────────────────────────────────────────

async def _llm_generate_json(system_type: str, user: str, max_tokens: int = 512) -> dict:
    raw = await llama_client.chat_json(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPTS[system_type]},
            {"role": "user",   "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.1,
    )
    m = _JSON_FENCE.search(raw)
    cleaned = m.group(1).strip() if m else raw.strip()
    return json.loads(cleaned)


async def _vlm_describe(image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    # VLM describe requires a multimodal endpoint (USE_VLM=true).
    # When USE_VLM=false (default), this path is never reached.
    raise NotImplementedError(
        "VLM describe requires USE_VLM=true and a dedicated VLM endpoint. "
        "Set USE_VLM=false to skip image/video processing."
    )


# ── Parsing helpers ────────────────────────────────────────────────────────────

async def _parse_doc(docling, bucket: str, object_key: str, extension: str) -> list[dict]:
    """docling: any object with .parse(bucket, object_key, extension) -> DoclingResult"""
    result = await docling.parse(bucket=bucket, object_key=object_key, extension=extension)
    chunks = []
    for pc in result.chunks:
        chunk: dict = {
            "block_index": pc.block_index,
            "content": pc.content,
            "table_involved": pc.table_involved,
            "table": None,
        }
        if pc.table is not None:
            chunk["table"] = {
                "table_name": pc.table.table_name,
                "description": pc.table.description,
                "data": pc.table.data,
            }
        chunks.append(chunk)
    return chunks


async def _parse_image(file_bytes: bytes, extension: str) -> list[dict]:
    content_type = f"image/{extension.lstrip('.')}"
    description = await _vlm_describe(file_bytes, content_type)
    return [{"block_index": 0, "content": description, "table_involved": False, "table": None}]


async def _parse_video(file_bytes: bytes) -> list[dict]:
    try:
        import av  # type: ignore[import]
    except ImportError:
        log.error("PyAV not installed — cannot extract video frames.")
        raise

    container = av.open(io.BytesIO(file_bytes))
    video_stream = next((s for s in container.streams if s.type == "video"), None)
    if video_stream is None:
        raise ValueError("No video stream found in file")

    chunks: list[dict] = []
    for i, frame in enumerate(container.decode(video_stream)):
        if i % cfg.VLM_FRAME_INTERVAL != 0:
            continue
        buf = io.BytesIO()
        frame.to_image().save(buf, format="JPEG")
        description = await _vlm_describe(buf.getvalue(), "image/jpeg")
        chunks.append({
            "block_index": len(chunks),
            "content": f"[Frame {i}] {description}",
            "table_involved": False,
            "table": None,
        })

    container.close()
    return chunks


# ── Filtering ─────────────────────────────────────────────────────────────────

def _exact_match_blocked(content: str, banned_phrases: list[str]) -> bool:
    lower = content.lower()
    return any(phrase.lower() in lower for phrase in banned_phrases)


async def _llm_policy_blocked(content: str, nlp_rules: list[str]) -> bool:
    if not nlp_rules:
        return False
    rules_text = "\n".join(f"- {r}" for r in nlp_rules)
    result = await _llm_generate_json(
        system_type="moderate",
        user=f"Rules:\n{rules_text}\n\nChunk:\n{content[:2000]}",
        max_tokens=128,
    )
    return bool(result.get("blocked", False))


async def _filter_chunks(
    postgres: PostgresClient,
    tenant_id: str,
    chunks: list[dict],
    emitter: PipelineEventEmitter | None = None,
) -> list[dict]:
    policies_res = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id,
        joins_table=["KBFilterPolicy"],
        filters=[WhereFilter(table_name="KBFilterPolicy", column_name="is_active", value=True)],
        limit=100,
    ))

    exact_phrases: list[str] = []
    nlp_rules: list[str] = []
    if policies_res.code == 200:
        for p in (policies_res.data or []):
            policy_config = p.get("config") or {}
            rules = policy_config.get("rules") or []
            if p.get("configformat") == PolicyFilteringType.EXACT_MATCH.value:
                exact_phrases.extend(rules)
            elif p.get("configformat") == PolicyFilteringType.NATURAL_LANG.value:
                nlp_rules.extend(rules)

    if emitter:
        await emitter.emit("silver.filter.start", {
            "total": len(chunks),
            "exact_rules": len(exact_phrases),
            "nlp_rules": len(nlp_rules),
        })

    accepted: list[dict] = []
    for chunk in chunks:
        content = chunk["content"]
        block_index = chunk["block_index"]

        if exact_phrases and _exact_match_blocked(content, exact_phrases):
            log.info("Silver filter: exact-match blocked block_index=%d", block_index)
            if emitter:
                await emitter.emit("silver.filter.blocked", {
                    "index": block_index,
                    "method": "exact_match",
                    "reason": "Matched a banned phrase",
                })
            continue

        if nlp_rules and await _llm_policy_blocked(content, nlp_rules):
            log.info("Silver filter: LLM policy blocked block_index=%d", block_index)
            if emitter:
                await emitter.emit("silver.filter.blocked", {
                    "index": block_index,
                    "method": "nlp_policy",
                    "reason": "Blocked by NLP content policy",
                })
            continue

        if emitter:
            await emitter.emit("silver.filter.accepted", {"index": block_index})
        accepted.append(chunk)

    return accepted


# ── Main stage function ────────────────────────────────────────────────────────

async def promote_to_silver(
    minio: MinIOClient,
    postgres: PostgresClient,
    docling,
    mongo: MongoClient,
    kafka_producer: KafkaProducerClient,
    data_id: str,
    tenant_id: str,
    approved_by: str,
    emitter: PipelineEventEmitter | None = None,
) -> dict:
    """
    Load bronze file → parse → filter → store chunks to MongoDB silver staging.
    Updates KBData tier to SILVER and publishes a gold promotion event to Kafka.
    Returns: {data_id, chunks_count, layer}
    """
    data_res = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id,
        joins_table=["KBData"],
        filters=[WhereFilter(table_name="KBData", column_name="data_id",
                             value=uuid.UUID(data_id))],
        limit=1,
    ))
    if data_res.code != 200 or not data_res.data:
        raise ValueError(f"KBData not found: data_id={data_id}")

    kb_data = data_res.data[0]
    source_type = SourceType(kb_data["source_type"])
    path: str = kb_data["path"]
    extension: str = kb_data["extension"]

    if emitter:
        await emitter.emit("silver.start", {
            "source_type": source_type.value,
            "parser": "docling" if source_type in (SourceType.DOC, SourceType.WEB) else "vlm",
        })

    if source_type in (SourceType.DOC, SourceType.WEB):
        if emitter:
            await emitter.emit("silver.parse.start", {"parser": "InlineDoclingParser"})
        raw_chunks = await _parse_doc(docling, cfg.MINIO_BUCKET, path, extension)
    elif source_type in (SourceType.IMAGE, SourceType.VIDEO):
        file_bytes = await minio.download(cfg.MINIO_BUCKET, path)
        log.info("Silver: downloaded %d bytes data_id=%s", len(file_bytes), data_id)
        if source_type == SourceType.IMAGE:
            if emitter:
                await emitter.emit("silver.parse.start", {"parser": "VLM (image)"})
            raw_chunks = await _parse_image(file_bytes, extension)
        else:
            if emitter:
                await emitter.emit("silver.parse.start", {"parser": "VLM (video frames)"})
            raw_chunks = await _parse_video(file_bytes)
    else:
        raise ValueError(f"Unsupported source_type for silver promotion: {source_type}")

    log.info("Silver: parsed %d chunks data_id=%s", len(raw_chunks), data_id)

    # Emit each parsed chunk
    if emitter:
        for chunk in raw_chunks:
            content = chunk["content"]
            await emitter.emit("silver.chunk.found", {
                "index":         chunk["block_index"],
                "preview":       content[:200],
                "length":        len(content),
                "table_involved": chunk.get("table_involved", False),
                "table_name":    (chunk.get("table") or {}).get("table_name"),
            })

    accepted_chunks = await _filter_chunks(postgres, tenant_id, raw_chunks, emitter)
    log.info("Silver: %d/%d chunks passed filters data_id=%s",
             len(accepted_chunks), len(raw_chunks), data_id)

    for i, chunk in enumerate(accepted_chunks):
        chunk["block_index"] = i

    mongo_db = mongo.get_client()
    await mongo_db["kb_silver_staging"].replace_one(
        {"data_id": data_id},
        {
            "data_id": data_id,
            "tenant_id": tenant_id,
            "source_type": source_type.value,
            "chunks": accepted_chunks,
        },
        upsert=True,
    )

    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBDataORM)
            .where(KBDataORM.data_id == uuid.UUID(data_id))
            .values(current_tier=Tier.SILVER.value)
        )
        await session.commit()

    await postgres.insert(KBLifecycleHistoryInsert(
        data_id=data_id,
        to_tier=Tier.SILVER,
        from_tier=Tier.BRONZE,
        approved_by=approved_by,
        notes=f"Promoted to silver: {len(accepted_chunks)} chunks accepted",
    ))

    rejected = len(raw_chunks) - len(accepted_chunks)
    if emitter:
        await emitter.emit("silver.complete", {
            "accepted": len(accepted_chunks),
            "rejected": rejected,
            "total":    len(raw_chunks),
        })

    # NOTE: Do NOT auto-promote to GOLD. Wait for explicit user request via /promote/{data_id}/gold endpoint.
    log.info("Silver complete data_id=%s chunks=%d — waiting for gold promotion request", data_id, len(accepted_chunks))
    return {"data_id": data_id, "chunks_count": len(accepted_chunks), "layer": Tier.SILVER.value}
