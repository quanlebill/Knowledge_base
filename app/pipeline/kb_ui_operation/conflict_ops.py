"""Business logic for conflict listing, detail, and resolution."""
import datetime
import logging
from fastapi import HTTPException
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, WhereFilter,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import KBConflictORM
from services.parse_for_ui.mappers import to_string

log = logging.getLogger(__name__)

_TYPE_MAP = {
    "content_contradiction": "Content Contradiction",
    "content_conflict":      "Content Conflict",
    "content_duplicate":     "Content Duplicate",
    "content_update":        "Content Update",
    "table_schema":          "Table Schema",
}
_SEV_MAP = {"low": "Low", "medium": "Medium", "high": "High"}


def _summary(row: dict) -> dict:
    return {
        "conflict_id":   to_string(row.get("conflict_id")),
        "conflict_type": _TYPE_MAP.get(row.get("conflict_type", ""), "Content Conflict"),
        "severity":      _SEV_MAP.get(row.get("severity", ""), "Medium"),
        "detected_at":   to_string(row.get("detected_at", "")),
    }


def _detail(row: dict) -> dict:
    return {
        **_summary(row),
        "where_happens":           f"batch/{to_string(row.get('batch_id'))}" if row.get("batch_id") else "unknown",
        "status":                  row.get("status", "pending"),
        "detailed_explanation":    row.get("detailed_explanation", ""),
        "existing_snapshot":       row.get("existing_snapshot") or {},
        "incoming_snapshot":       row.get("incoming_snapshot") or {},
        "affected_location":       to_string(row.get("conflict_id")),
        "batch_id":                to_string(row.get("batch_id", "")),
        "resolution_instruction":      row.get("resolution_instruction"),
        "selected_resolution_method":  row.get("resolution_method"),
        "resolved_at":  to_string(row.get("resolved_at", "")),
        "resolved_by":  row.get("resolved_by"),
    }


async def list_conflicts(postgres, tenant_id: str | None) -> dict:
    batch_resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id, joins_table=["KBConflictBatch"], limit=100,
    ))
    batches = {to_string(r["batch_id"]): r for r in (batch_resp.data or [])}

    conf_resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id, joins_table=["KBConflict"], limit=500,
    ))
    all_conflicts = conf_resp.data or []

    pending_batches: dict[str, dict] = {}
    awaiting: list[dict] = []
    resolved: list[dict] = []

    for row in all_conflicts:
        status = row.get("status", "pending")
        bid = to_string(row.get("batch_id", ""))

        if status == "pending":
            if bid not in pending_batches:
                batch = batches.get(bid, {})
                pending_batches[bid] = {
                    "batch_id":               bid,
                    "batch_name":             batch.get("batch_title", f"Batch {bid[:8]}"),
                    "extracted_date":         to_string(batch.get("created_at", "")),
                    "number_pending_conflict": 0,
                    "conflicts":              [],
                }
            pending_batches[bid]["number_pending_conflict"] += 1
            pending_batches[bid]["conflicts"].append(_summary(row))
        elif status == "awaiting":
            awaiting.append(_summary(row))
        elif status == "resolved":
            resolved.append(_summary(row))

    return {
        "pending":  list(pending_batches.values()),
        "awaiting": awaiting,
        "resolved": resolved,
    }


async def get_conflict(postgres, conflict_id: str, tenant_id: str | None) -> dict:
    resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id,
        joins_table=["KBConflict"],
        filters=[WhereFilter(table_name="KBConflict", column_name="conflict_id", value=conflict_id)],
        limit=1,
    ))
    if resp.code != 200 or not resp.data:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return _detail(resp.data[0])


async def resolve_conflict(
    postgres,
    conflict_id: str,
    method: str,
    instruction: str,
    user_id: str,
) -> dict:
    new_status = "awaiting" if method == "Merge" else "resolved"
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBConflictORM)
            .where(KBConflictORM.conflict_id == conflict_id)
            .values(
                status=new_status,
                resolution_method=method,
                resolution_instruction=instruction or None,
                resolved_by=user_id,
                resolved_at=datetime.datetime.now(datetime.timezone.utc),
            )
        )
        await session.commit()
    log.info("resolve_conflict %s method=%s status=%s", conflict_id, method, new_status)
    return {"conflict_id": conflict_id, "status": new_status}
