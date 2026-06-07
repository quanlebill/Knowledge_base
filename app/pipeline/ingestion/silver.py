"""
Silver stage: load from MinIO → parse/describe → filter → store chunks to MongoDB.
Doc/web: Docling.  Image: VLM single-shot.  Video: VLM per sampled frame.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import tempfile
import uuid

import litellm
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
from services.docling.docling_service import DoclingClient
from app.pipeline.ingestion import config as cfg

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
    """Text completion path → /api/generate on llama (stateless, pre-cached system)."""
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


async def _vlm_describe(image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Chat/multimodal path → /api/chat on llama (image content must go through chat)."""
    b64 = base64.b64encode(image_bytes).decode()
    resp = await litellm.acompletion(
        model=cfg.VLM_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
                {
                    "type": "text",
                    "text": (
                        "Provide a comprehensive description of this image. "
                        "Include all visible text, objects, charts, tables, diagrams, "
                        "and any other relevant information."
                    ),
                },
            ],
        }],
        api_base=cfg.LITELLM_BASE_URL,
        max_tokens=1024,
    )
    return resp.choices[0].message.content


# ── Parsing helpers ────────────────────────────────────────────────────────────

async def _parse_doc(docling: DoclingClient, file_bytes: bytes, extension: str) -> list[dict]:
    suffix = f".{extension}" if not extension.startswith(".") else extension
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        result = await docling.parse(tmp_path)
    finally:
        os.unlink(tmp_path)

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
        log.error("PyAV not installed — cannot extract video frames. Add 'av' to requirements.")
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
            config = p.get("config") or {}
            rules = config.get("rules") or []
            if p.get("configformat") == PolicyFilteringType.EXACT_MATCH.value:
                exact_phrases.extend(rules)
            elif p.get("configformat") == PolicyFilteringType.NATURAL_LANG.value:
                nlp_rules.extend(rules)

    accepted: list[dict] = []
    for chunk in chunks:
        content = chunk["content"]
        if exact_phrases and _exact_match_blocked(content, exact_phrases):
            log.info("Silver filter: exact-match blocked block_index=%d", chunk["block_index"])
            continue
        if nlp_rules and await _llm_policy_blocked(content, nlp_rules):
            log.info("Silver filter: LLM policy blocked block_index=%d", chunk["block_index"])
            continue
        accepted.append(chunk)

    return accepted


# ── Main stage function ────────────────────────────────────────────────────────

async def promote_to_silver(
    minio: MinIOClient,
    postgres: PostgresClient,
    docling: DoclingClient,
    mongo: MongoClient,
    kafka_producer: KafkaProducerClient,
    data_id: str,
    tenant_id: str,
    approved_by: str,
) -> dict:
    """
    Load bronze file → parse → filter → store chunks to MongoDB silver staging.
    Updates KBData tier to SILVER and publishes a gold promotion event to Kafka.
    Returns: {data_id, chunks_count, layer}
    """
    # Load KBData record to get path and source_type
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

    # Download file bytes from MinIO
    file_bytes = await minio.download(cfg.MINIO_BUCKET, path)
    log.info("Silver: downloaded %d bytes data_id=%s", len(file_bytes), data_id)

    # Parse by source type
    if source_type in (SourceType.DOC, SourceType.WEB):
        raw_chunks = await _parse_doc(docling, file_bytes, extension)
    elif source_type == SourceType.IMAGE:
        raw_chunks = await _parse_image(file_bytes, extension)
    elif source_type == SourceType.VIDEO:
        raw_chunks = await _parse_video(file_bytes)
    else:
        raise ValueError(f"Unsupported source_type for silver promotion: {source_type}")

    log.info("Silver: parsed %d chunks data_id=%s", len(raw_chunks), data_id)

    # Filter chunks via policy
    accepted_chunks = await _filter_chunks(postgres, tenant_id, raw_chunks)
    log.info("Silver: %d/%d chunks passed filters data_id=%s",
             len(accepted_chunks), len(raw_chunks), data_id)

    # Renumber block_index after filtering
    for i, chunk in enumerate(accepted_chunks):
        chunk["block_index"] = i

    # Store to MongoDB silver staging
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

    # Update KBData tier to SILVER
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBDataORM)
            .where(KBDataORM.data_id == uuid.UUID(data_id))
            .values(current_tier=Tier.SILVER.value)
        )
        await session.commit()

    # Lifecycle history
    await postgres.insert(KBLifecycleHistoryInsert(
        data_id=data_id,
        to_tier=Tier.SILVER,
        from_tier=Tier.BRONZE,
        approved_by=approved_by,
        notes=f"Promoted to silver: {len(accepted_chunks)} chunks accepted",
    ))

    # Publish gold promotion event to Kafka
    await kafka_producer.produce(
        topic=cfg.KAFKA_TOPIC_GOLD,
        value={"stage": "gold", "data_id": data_id, "tenant_id": tenant_id,
               "approved_by": approved_by},
        key=data_id,
    )

    log.info("Silver complete data_id=%s chunks=%d", data_id, len(accepted_chunks))
    return {"data_id": data_id, "chunks_count": len(accepted_chunks), "layer": Tier.SILVER.value}
