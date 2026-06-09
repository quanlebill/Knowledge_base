"""Business logic for document listing, promotion, and deletion."""
import logging
from fastapi import HTTPException
from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, WhereFilter, KBDataDelete,
)
from services.backend.pipeline.ingestion import config as ing_cfg
from services.backend.UI_model.response import DocResponse

log = logging.getLogger(__name__)


async def fetch_one(postgres, data_id: str, tenant_id: str | None) -> dict | None:
    resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id,
        joins_table=["KBData"],
        filters=[WhereFilter(table_name="KBData", column_name="data_id", value=data_id)],
        limit=1,
    ))
    if resp.code == 200 and resp.data:
        return resp.data[0]
    return None


async def list_documents(postgres, tenant_id: str | None) -> list:
    resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id, joins_table=["KBData"], limit=200,
    ))
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error)
    return [DocResponse.model_validate(r).model_dump() for r in (resp.data or [])]


async def promote_document(
    postgres, kafka_producer,
    data_id: str, target: str, status: str,
    ctx: dict, record: dict,
) -> dict:
    tenant_id = ctx["tenant_id"]
    if target == "silver":
        await kafka_producer.produce(
            topic=ing_cfg.KAFKA_TOPIC_SILVER,
            value={
                "event":       "promote_silver",
                "data_id":     data_id,
                "tenant_id":   tenant_id or str(record.get("tenant_id", "")),
                "source_type": record.get("source_type", "doc"),
                "extension":   record.get("extension", ""),
                "minio_path":  record.get("path", ""),
                "approved_by": ctx["user_id"],
            },
            key=data_id,
        )
    elif target == "gold":
        await kafka_producer.produce(
            topic=ing_cfg.KAFKA_TOPIC_GOLD,
            value={
                "event":       "promote_gold",
                "data_id":     data_id,
                "tenant_id":   tenant_id or str(record.get("tenant_id", "")),
                "neo4j_connection_id": "",
                "approved_by": ctx["user_id"],
            },
            key=data_id,
        )
    else:
        raise HTTPException(status_code=422, detail=f"Unknown target tier: {target}")

    log.info("promote_document %s → %s by %s", data_id, target, ctx["user_id"])
    # Rebuild the response from the (now-stale) record with the target tier
    # so the caller sees the post-promotion state without an extra DB read.
    record_after = dict(record)
    record_after["current_tier"] = target
    return DocResponse.model_validate(record_after).model_dump()


async def delete_document(postgres, data_id: str, tenant_id: str | None, record: dict) -> None:
    resp = await postgres.soft_delete(KBDataDelete(
        tenant_id=tenant_id or str(record.get("tenant_id", "")),
        data_id=data_id,
    ))
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error or "Delete failed")
    log.info("delete_document %s", data_id)
