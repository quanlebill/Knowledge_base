"""Business logic for the Fleet dashboard stats aggregation."""
import logging
from basemodel.services_databaseconnector.postgres_model import ReadJoinRequest
from services.parse_for_ui.mappers import map_fleet_stats

log = logging.getLogger(__name__)


async def get_fleet_stats(postgres, qdrant, tenant_id: str | None) -> dict:
    docs_resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id, joins_table=["KBData"], limit=1000,
    ))
    gold_docs = [
        r for r in (docs_resp.data or [])
        if (r.get("current_tier") or "") == "gold"
    ]

    qdrant_rows: list = []
    try:
        result = await qdrant.get_client().get_collections()
        qdrant_rows = result.collections
    except Exception as e:
        log.warning("fleet_ops: qdrant count failed: %s", e)

    neo_conns: list = []
    try:
        nc_resp = await postgres.read(ReadJoinRequest(
            tenant_id=tenant_id, joins_table=["KBNeo4jConnection"], limit=10,
        ))
        neo_conns = nc_resp.data or []
    except Exception as e:
        log.warning("fleet_ops: neo4j stats failed: %s", e)

    batches: list = []
    try:
        cf_resp = await postgres.read(ReadJoinRequest(
            tenant_id=tenant_id, joins_table=["KBConflictBatch"], limit=200,
        ))
        batches = cf_resp.data or []
    except Exception as e:
        log.warning("fleet_ops: conflicts count failed: %s", e)

    return map_fleet_stats(gold_docs, qdrant_rows, neo_conns, batches).model_dump()
