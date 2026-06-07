"""
AeroFlow KB — FastAPI router.

Each handler:
  1. Extracts JWT claims (tenant_id, role_id, user_id, role) from the
     Authorization header via parse_jwt().
  2. Calls pg / qd / neo db_client functions directly.
  3. Shapes the response to only the fields the UI needs.

Fake JWT simulation:
  • Named demo tokens  →  "Bearer demo-admin" | "demo-engineer" | "demo-operator" | "demo-executive"
  • Base64 JSON payload →  base64({"tenant_id": "...", "role_id": "...", "user_id": "...", "role": "PLATFORM_ADMIN"})
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import services.database_connector.neo4j.db_client as neo
import services.database_connector.postgres.db_client as pg
import services.database_connector.qdrant.db_client as qd
from fastapi import APIRouter, Depends, Header, HTTPException
from services.database_connector.response_model import ResponseModel

from basemodel.kb.conflict import RequestResolveConflict
from basemodel.kb.data import (
    RequestConfirmDataUpload,
    RequestDataUpload,
    RequestUpdateDocument,
)
from basemodel.kb.knowledge import (
    RequestActivateChunkVersion,
    RequestCreateChunkVersion,
    RequestDocConfig,
    RequestNeo4jQuery,
    RequestSearchQdrant,
    RequestTableRowUpdate,
    RequestToggleQdrantCollection,
    RequestWarehouseConfigCreate,
)
from basemodel.kb.policy import (
    RequestCreateFilterPolicy,
    RequestExtractionCustom,
    RequestUpdateFilterPolicy,
)
from basemodel.kb.warehouse import RequestConnectWarehouse, RequestSelectTable
from services.parse_for_ui import (
    build_neo4j_schema,
    handle_response,
    map_chunks,
    map_conflict_batches,
    map_conflict_detail,
    map_conflict_type,
    map_doc,
    map_extraction_policy,
    map_filter_policies,
    map_filter_policy,
    map_fleet_stats,
    map_neo4j_graph,
    map_qdrant_collection,
    map_qdrant_collections,
    map_qdrant_point,
    map_severity,
    map_tables,
    map_warehouse_configs,
    parse_jsonb,
    policy_fmt_to_type,
    policy_rules_to_list,
    policy_rules_to_str,
    policy_type_to_fmt,
    q_chunks,
    q_conflict_detail,
    q_conflicts,
    q_neo4j_edges,
    q_neo4j_schema_edges,
    q_qdrant_collection_by_id,
    q_qdrant_collection_name,
    q_qdrant_collections,
    q_qdrant_fleet_count,
    q_tables,
    to_string,
)

# ── Logger ────────────────────────────────────────────────────────────────────

_LOG_DIR = Path(os.getenv("LOG_DIR", "logs"))
_LOG_DIR.mkdir(parents=True, exist_ok=True)

log = logging.getLogger("aeroflow.router")
log.setLevel(logging.INFO)

if not log.handlers:
    _fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _file_handler = logging.FileHandler(_LOG_DIR / "router.log")
    _file_handler.setFormatter(_fmt)
    _stream_handler = logging.StreamHandler()
    _stream_handler.setFormatter(_fmt)
    log.addHandler(_file_handler)
    log.addHandler(_stream_handler)
    log.propagate = False


# ── JWT simulation ─────────────────────────────────────────────────────────────


@dataclass
class JWTClaims:
    tenant_id: uuid.UUID
    role_id: uuid.UUID
    user_id: uuid.UUID
    role: str


_TENANT_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
_TENANT_B = uuid.UUID("22222222-2222-2222-2222-222222222222")
_ROLE_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
_USER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

_DEMO: dict[str, JWTClaims] = {
    "demo-admin": JWTClaims(_TENANT_A, _ROLE_ID, _USER_ID, "PLATFORM_ADMIN"),
    "demo-engineer": JWTClaims(_TENANT_A, _ROLE_ID, _USER_ID, "AI_ENGINEER"),
    "demo-operator": JWTClaims(_TENANT_B, _ROLE_ID, _USER_ID, "BUSINESS_OPERATOR"),
    "demo-executive": JWTClaims(_TENANT_A, _ROLE_ID, _USER_ID, "EXECUTIVE"),
}


def parse_jwt(authorization: str = Header(default="Bearer demo-admin")) -> JWTClaims:
    return JWTClaims(_TENANT_A, _ROLE_ID, _USER_ID, "PLATFORM_ADMIN")


# ── Permission guard ───────────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "PLATFORM_ADMIN": {
        "delete_data",
        "edit_conflict",
        "process_layer",
        "add_data",
        "add_warehouse",
        "add_filtering_policy",
        "edit_filtering_policy",
        "delete_filtering_policy",
        "edit_extraction_policy",
        "toggle_qdrant",
        "add_warehouse_config",
        "edit_warehouse_config",
        "add_chunk_version",
    },
    "AI_ENGINEER": {"toggle_qdrant", "edit_extraction_policy", "add_chunk_version"},
    "BUSINESS_OPERATOR": {
        "add_warehouse",
        "add_warehouse_config",
        "edit_warehouse_config",
    },
    "EXECUTIVE": {"edit_conflict", "process_layer", "add_filtering_policy"},
}

# UTILITIES


# permission validation
def require_permission(*perms: str):
    def _dep(claims: JWTClaims = Depends(parse_jwt)):
        allowed = ROLE_PERMISSIONS.get(claims.role, set())
        for p in perms:
            if p not in allowed:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": f"Role {claims.role!r} lacks permission: {p}",
                        "required": p,
                    },
                )

    return _dep


def OK(data: Any) -> ResponseModel:
    return ResponseModel(code=200, data=data)


def CREATED(data: Any) -> ResponseModel:
    return ResponseModel(code=201, data=data)


def ERR(code: int, msg: str) -> ResponseModel:
    return ResponseModel(code=code, error=msg)


router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# FLEET
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/api/fleet/stats", response_model=ResponseModel, tags=["Fleet"])
async def get_fleet_stats(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/fleet/stats | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBData | tenant=%s, tier=gold",
            claims.tenant_id,
        )
        gold_docs = handle_response(
            await pg.read(
                "KBData",
                {
                    "tenant_id": claims.tenant_id,
                    "current_tier": "gold",
                    "limit": 1000,
                },
            )
        )
        log.info(
            "service=postgres, method=read_join, query=q_qdrant_fleet_count | tenant=%s",
            claims.tenant_id,
        )
        qdrant_rows = handle_response(
            await pg.read_join(q_qdrant_fleet_count(claims.tenant_id))
        )
        log.info(
            "service=postgres, method=read, table=KBNeo4jConnection | tenant=%s",
            claims.tenant_id,
        )
        neo_conns = handle_response(
            await pg.read("KBNeo4jConnection", {"tenant_id": claims.tenant_id})
        )
        log.info(
            "service=postgres, method=read, table=KBConflictBatch | tenant=%s",
            claims.tenant_id,
        )
        batches = handle_response(
            await pg.read(
                "KBConflictBatch", {"tenant_id": claims.tenant_id, "limit": 500}
            )
        )
        return OK(map_fleet_stats(gold_docs, qdrant_rows, neo_conns, batches))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# DATA / INVENTORY
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/api/data/documents", response_model=ResponseModel, tags=["Data"])
async def get_documents(claims: JWTClaims = Depends(parse_jwt)):
    """Return all documents for the tenant across all layers."""
    log.info("GET /api/data/documents | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBData | tenant=%s, limit=200",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read("KBData", {"tenant_id": claims.tenant_id, "limit": 200})
        )
        return OK([map_doc(r) for r in rows])
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/data/documents/{doc_id}",
    response_model=ResponseModel,
    tags=["Data"],
    dependencies=[Depends(require_permission("process_layer"))],
)
async def update_document(
    doc_id: str,
    body: RequestUpdateDocument,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info("PATCH /api/data/documents/%s | tenant=%s", doc_id, claims.tenant_id)
    try:
        update: dict[str, Any] = {"data_id": uuid.UUID(doc_id)}
        if body.layer:
            update["current_tier"] = body.layer.lower()
        if body.metadata:
            update["metadata"] = body.metadata
        log.info("service=postgres, method=update, table=KBData | doc_id=%s", doc_id)
        handle_response(await pg.update("KBData", update))
        return OK({"doc_id": doc_id})
    except KeyError:
        return ERR(404, f"Document {doc_id} not found")
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/data/documents/{doc_id}",
    response_model=ResponseModel,
    tags=["Data"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_document(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info("DELETE /api/data/documents/%s | tenant=%s", doc_id, claims.tenant_id)
    try:
        log.info("service=postgres, method=delete, table=KBData | doc_id=%s", doc_id)
        handle_response(await pg.delete("KBData", {"data_id": uuid.UUID(doc_id)}))
        return OK({"doc_id": doc_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ── Stub endpoints (Agents / Deployments not in KB schema yet) ─────────────────


@router.get("/api/data/agents", response_model=ResponseModel, tags=["Data"])
async def get_agents(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/agents | tenant=%s", claims.tenant_id)
    return OK([])


@router.get("/api/data/traces", response_model=ResponseModel, tags=["Data"])
async def get_traces(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/traces | tenant=%s", claims.tenant_id)
    return OK([])


@router.get("/api/data/configs", response_model=ResponseModel, tags=["Data"])
async def get_agent_configs(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/configs | tenant=%s", claims.tenant_id)
    return OK([])


@router.get("/api/data/runs", response_model=ResponseModel, tags=["Data"])
async def get_runs(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/runs | tenant=%s", claims.tenant_id)
    return OK([])


@router.get("/api/data/deployments", response_model=ResponseModel, tags=["Data"])
async def get_deployments(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/deployments | tenant=%s", claims.tenant_id)
    return OK([])


@router.get("/api/data/environments", response_model=ResponseModel, tags=["Data"])
async def get_environments(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/data/environments | tenant=%s", claims.tenant_id)
    return OK([])


# ═══════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE HUB — DATABASE tab (Gold documents, chunks, tables, configs)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/api/knowledge/documents", response_model=ResponseModel, tags=["Knowledge"]
)
async def get_kg_documents(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/knowledge/documents | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBData | tenant=%s, tier=gold, limit=200",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBData",
                {
                    "tenant_id": claims.tenant_id,
                    "current_tier": "gold",
                    "limit": 200,
                },
            )
        )
        return OK([map_doc(r) for r in rows])
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.get(
    "/api/knowledge/documents/{doc_id}",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def get_kg_document(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/knowledge/documents/%s | tenant=%s", doc_id, claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBData | doc_id=%s, tenant=%s",
            doc_id,
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBData",
                {
                    "tenant_id": claims.tenant_id,
                    "data_id": uuid.UUID(doc_id),
                    "limit": 1,
                },
            )
        )
        if not rows:
            return ERR(404, f"Document {doc_id} not found")
        return OK(map_doc(rows[0]))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ── Chunks ────────────────────────────────────────────────────────────────────


@router.get(
    "/api/knowledge/documents/{doc_id}/chunks",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def get_chunks(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info(
        "GET /api/knowledge/documents/%s/chunks | tenant=%s", doc_id, claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read_join, query=q_chunks | doc_id=%s", doc_id
        )
        rows = handle_response(await pg.read_join(q_chunks(uuid.UUID(doc_id))))

        return OK(map_chunks(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions",
    response_model=ResponseModel,
    status_code=201,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_chunk_version"))],
)
async def create_chunk_version(
    doc_id: str,
    chunk_id: str,
    body: RequestCreateChunkVersion,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "POST /api/knowledge/documents/%s/chunks/%s/versions | tenant=%s",
        doc_id,
        chunk_id,
        claims.tenant_id,
    )
    try:
        chunk_uuid = uuid.UUID(chunk_id)
        log.info(
            "service=postgres, method=read, table=KBTextBlockVersion | chunk_id=%s",
            chunk_id,
        )
        existing = handle_response(
            await pg.read("KBTextBlockVersion", {"block_id": chunk_uuid})
        )
        next_num = max((v["version_number"] for v in existing), default=0) + 1
        log.info(
            "service=postgres, method=create, table=KBTextBlockVersion | chunk_id=%s, version=%s",
            chunk_id,
            next_num,
        )
        res = handle_response(
            await pg.create(
                "KBTextBlockVersion",
                {
                    "block_id": chunk_uuid,
                    "version_number": next_num,
                    "content": body.text,
                    "created_by": claims.user_id,
                },
            )
        )
        return CREATED(
            {"version_id": res.get("version_id"), "version_number": next_num}
        )
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/activate",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_chunk_version"))],
)
async def activate_chunk_version(
    doc_id: str,
    chunk_id: str,
    body: RequestActivateChunkVersion,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PATCH /api/knowledge/documents/%s/chunks/%s/activate | tenant=%s, version=%s",
        doc_id,
        chunk_id,
        claims.tenant_id,
        body.version_number,
    )
    try:
        chunk_uuid = uuid.UUID(chunk_id)
        log.info(
            "service=postgres, method=read, table=KBTextBlockVersion | chunk_id=%s",
            chunk_id,
        )
        versions = handle_response(
            await pg.read("KBTextBlockVersion", {"block_id": chunk_uuid})
        )
        target = next(
            (
                v
                for v in versions
                if str(v["version_number"]) == str(body.version_number)
            ),
            None,
        )
        if target is None:
            return ERR(
                404, f"Version {body.version_number} not found for chunk {chunk_id}"
            )

        # Deactivate every currently-active version for this block
        log.info(
            "service=postgres, method=update, table=KBTextBlockVersion | chunk_id=%s, action=deactivate_active",
            chunk_id,
        )
        for v in versions:
            if v.get("is_active"):
                await pg.update(
                    "KBTextBlockVersion",
                    {
                        "version_id": v["version_id"],
                        "is_active": False,
                    },
                )

        log.info(
            "service=postgres, method=update, table=KBTextBlockVersion | version_id=%s, action=activate",
            target["version_id"],
        )
        handle_response(
            await pg.update(
                "KBTextBlockVersion",
                {
                    "version_id": target["version_id"],
                    "is_active": True,
                },
            )
        )
        return OK({"version_id": to_string(target["version_id"])})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions/{version_number}",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_chunk_version(
    doc_id: str,
    chunk_id: str,
    version_number: str,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "DELETE /api/knowledge/documents/%s/chunks/%s/versions/%s | tenant=%s",
        doc_id,
        chunk_id,
        version_number,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBTextBlockVersion | chunk_id=%s",
            chunk_id,
        )
        versions = handle_response(
            await pg.read("KBTextBlockVersion", {"block_id": uuid.UUID(chunk_id)})
        )
        target = next(
            (v for v in versions if str(v["version_number"]) == version_number), None
        )
        if target is None:
            return ERR(404, f"Version {version_number} not found")
        vid = target["version_id"]
        log.info(
            "service=postgres, method=delete, table=KBTextTable | version_id=%s", vid
        )
        await pg.delete("KBTextTable", {"version_id": vid})  # no-op if no table row
        log.info(
            "service=postgres, method=delete, table=KBTextBlockVersion | version_id=%s",
            vid,
        )
        handle_response(await pg.delete("KBTextBlockVersion", {"version_id": vid}))
        return OK({"version_id": to_string(vid)})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_chunk(
    doc_id: str, chunk_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "DELETE /api/knowledge/documents/%s/chunks/%s | tenant=%s",
        doc_id,
        chunk_id,
        claims.tenant_id,
    )
    try:
        chunk_uuid = uuid.UUID(chunk_id)
        log.info(
            "service=postgres, method=read, table=KBTextBlockVersion | chunk_id=%s",
            chunk_id,
        )
        versions = handle_response(
            await pg.read("KBTextBlockVersion", {"block_id": chunk_uuid})
        )
        log.info(
            "service=postgres, method=delete, table=KBTextTable+KBTextBlockVersion | chunk_id=%s, versions=%d",
            chunk_id,
            len(versions),
        )
        for v in versions:
            vid = v["version_id"]
            await pg.delete("KBTextTable", {"version_id": vid})  # no-op if no table row
            handle_response(await pg.delete("KBTextBlockVersion", {"version_id": vid}))
        log.info(
            "service=postgres, method=delete, table=KBTextBlock | chunk_id=%s", chunk_id
        )
        handle_response(await pg.delete("KBTextBlock", {"block_id": chunk_uuid}))
        return OK({"chunk_id": chunk_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ── Tables ────────────────────────────────────────────────────────────────────


@router.get(
    "/api/knowledge/documents/{doc_id}/tables",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def get_tables(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBTextBlock → KBTextBlockVersion → KBTextTable
    to return only active, table-bearing block versions.
    """
    log.info(
        "GET /api/knowledge/documents/%s/tables | tenant=%s", doc_id, claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read_join, query=q_tables | doc_id=%s", doc_id
        )
        rows = handle_response(await pg.read_join(q_tables(uuid.UUID(doc_id))))

        return OK(map_tables(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/tables/{table_id}/rows/{row_index}",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def update_table_row(
    doc_id: str,
    table_id: str,
    row_index: int,
    body: RequestTableRowUpdate,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PATCH /api/knowledge/documents/%s/tables/%s/rows/%d | tenant=%s, column=%s",
        doc_id,
        table_id,
        row_index,
        claims.tenant_id,
        body.column,
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBTextTable | table_id=%s", table_id
        )
        records = handle_response(
            await pg.read("KBTextTable", {"version_id": uuid.UUID(table_id)})
        )
        if not records:
            return ERR(404, f"Table {table_id} not found")
        table = records[0]
        data = table.get("data") or {}
        rows = data.get("rows", [])
        if row_index >= len(rows):
            return ERR(404, f"Row index {row_index} out of range")

        row = rows[row_index]
        if isinstance(row, dict):
            row[body.column] = body.value
        elif isinstance(row, list):
            cols = data.get("columns", [])
            try:
                col_idx = cols.index(body.column)
                row[col_idx] = body.value
            except ValueError:
                return ERR(400, f"Column {body.column!r} not found in table schema")

        data["rows"] = rows
        log.info(
            "service=postgres, method=update, table=KBTextTable | table_id=%s, row=%d",
            table_id,
            row_index,
        )
        handle_response(
            await pg.update(
                "KBTextTable", {"version_id": uuid.UUID(table_id), "data": data}
            )
        )
        return OK({"row_index": row_index, "column": body.column, "value": body.value})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/tables/{table_id}",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_table(
    doc_id: str, table_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "DELETE /api/knowledge/documents/%s/tables/%s | tenant=%s",
        doc_id,
        table_id,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=delete, table=KBTextTable | table_id=%s", table_id
        )
        handle_response(
            await pg.delete("KBTextTable", {"version_id": uuid.UUID(table_id)})
        )
        return OK({"table_id": table_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ── Warehouse document configs (per-doc CONFIGS tab) ──────────────────────────


@router.get(
    "/api/knowledge/documents/{doc_id}/configs",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def get_doc_configs(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info(
        "GET /api/knowledge/documents/%s/configs | tenant=%s", doc_id, claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBData | doc_id=%s, tenant=%s",
            doc_id,
            claims.tenant_id,
        )
        doc_rows = handle_response(
            await pg.read(
                "KBData",
                {
                    "tenant_id": claims.tenant_id,
                    "data_id": uuid.UUID(doc_id),
                    "limit": 1,
                },
            )
        )
        if not doc_rows:
            return ERR(404, f"Document {doc_id} not found")
        meta = doc_rows[0].get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        warehouse_id = meta.get("warehouse_id")
        if not warehouse_id:
            return OK([])
        return await _get_warehouse_configs(uuid.UUID(str(warehouse_id)))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/documents/{doc_id}/configs",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def create_doc_config(
    doc_id: str,
    body: RequestDocConfig,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "POST /api/knowledge/documents/%s/configs | tenant=%s", doc_id, claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBData | doc_id=%s, tenant=%s",
            doc_id,
            claims.tenant_id,
        )
        doc_rows = handle_response(
            await pg.read(
                "KBData",
                {
                    "tenant_id": claims.tenant_id,
                    "data_id": uuid.UUID(doc_id),
                    "limit": 1,
                },
            )
        )
        if not doc_rows:
            return ERR(404, f"Document {doc_id} not found")
        meta = doc_rows[0].get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        warehouse_id = meta.get("warehouse_id")
        if not warehouse_id:
            return ERR(400, "Document has no linked warehouse_id in metadata")
        return await _create_warehouse_config(
            uuid.UUID(str(warehouse_id)), body, claims
        )
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/configs/{config_id}/activate",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def activate_doc_config(
    doc_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "PATCH /api/knowledge/documents/%s/configs/%s/activate | tenant=%s",
        doc_id,
        config_id,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=update, table=KBWarehouse_Config | config_id=%s, action=activate",
            config_id,
        )
        handle_response(
            await pg.update(
                "KBWarehouse_Config",
                {
                    "config_id": uuid.UUID(config_id),
                    "is_active": True,
                },
            )
        )
        return OK({"config_id": config_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ── Warehouse ID resolution ───────────────────────────────────────────────────


async def _resolve_warehouse_id(
    tenant_id: uuid.UUID, candidate: uuid.UUID
) -> uuid.UUID:
    """
    The UI passes the KBData doc_id to warehouse endpoints.
    Resolve it to the actual KBWarehouse.warehouse_id stored in the doc's metadata.
    Falls back to the candidate itself when no mapping is found.
    """
    try:
        log.info(
            "service=postgres, method=read, table=KBData | tenant=%s, candidate_id=%s (resolve warehouse)",
            tenant_id,
            candidate,
        )
        rows = handle_response(
            await pg.read(
                "KBData", {"tenant_id": tenant_id, "data_id": candidate, "limit": 1}
            )
        )
        if rows:
            meta = rows[0].get("metadata") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            wh_id_raw = meta.get("warehouse_id")
            if wh_id_raw:
                return uuid.UUID(str(wh_id_raw))
    except Exception:
        pass
    return candidate


# ── Warehouse configs ─────────────────────────────────────────────────────────


async def _get_warehouse_configs(warehouse_id: uuid.UUID) -> ResponseModel:
    """Shared helper for both per-doc and per-warehouse config endpoints."""
    log.info(
        "service=postgres, method=read, table=KBWarehouse_Config | warehouse_id=%s",
        warehouse_id,
    )
    rows = handle_response(
        await pg.read("KBWarehouse_Config", {"warehouse_id": warehouse_id})
    )
    return OK(map_warehouse_configs(rows))


async def _create_warehouse_config(
    warehouse_id: uuid.UUID,
    body: RequestWarehouseConfigCreate,
    claims: JWTClaims,
) -> ResponseModel:
    tables = [
        (t.get("table_name") or t.get("id") or t) if isinstance(t, dict) else t
        for t in (body.tables or [])
    ]
    log.info(
        "service=postgres, method=create, table=KBWarehouse_Config | warehouse_id=%s, tables=%d",
        warehouse_id,
        len(tables),
    )
    res = handle_response(
        await pg.create(
            "KBWarehouse_Config",
            {
                "warehouse_id": warehouse_id,
                "version_number": int(body.version or 1),
                "is_active": False,
                "created_by": claims.user_id,
                "config": {
                    "selected_tables": tables,
                    "sync_schedule": body.sync_schedule or "Manual",
                },
            },
        )
    )
    return CREATED({"config_id": res.get("config_id")})


@router.get(
    "/api/knowledge/warehouses/{warehouse_id}/configs",
    response_model=ResponseModel,
    tags=["Knowledge"],
)
async def get_warehouse_configs(
    warehouse_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "GET /api/knowledge/warehouses/%s/configs | tenant=%s",
        warehouse_id,
        claims.tenant_id,
    )
    try:
        resolved = await _resolve_warehouse_id(
            claims.tenant_id, uuid.UUID(warehouse_id)
        )
        return await _get_warehouse_configs(resolved)
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/warehouses/{warehouse_id}/configs",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_warehouse_config"))],
)
async def create_warehouse_config(
    warehouse_id: str,
    body: RequestWarehouseConfigCreate,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "POST /api/knowledge/warehouses/%s/configs | tenant=%s",
        warehouse_id,
        claims.tenant_id,
    )
    try:
        resolved = await _resolve_warehouse_id(
            claims.tenant_id, uuid.UUID(warehouse_id)
        )
        return await _create_warehouse_config(resolved, body, claims)
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/activate",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("edit_warehouse_config"))],
)
async def activate_warehouse_config(
    warehouse_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "PATCH /api/knowledge/warehouses/%s/configs/%s/activate | tenant=%s",
        warehouse_id,
        config_id,
        claims.tenant_id,
    )
    try:
        resolved = await _resolve_warehouse_id(
            claims.tenant_id, uuid.UUID(warehouse_id)
        )
        log.info(
            "service=postgres, method=update, table=KBWarehouse_Config | config_id=%s, action=activate",
            config_id,
        )
        handle_response(
            await pg.update(
                "KBWarehouse_Config",
                {
                    "config_id": uuid.UUID(config_id),
                    "is_active": True,
                },
            )
        )
        return OK({"config_id": config_id, "warehouse_id": str(resolved)})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_warehouse_config(
    warehouse_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    log.info(
        "DELETE /api/knowledge/warehouses/%s/configs/%s | tenant=%s",
        warehouse_id,
        config_id,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=delete, table=KBWarehouse_Config | config_id=%s",
            config_id,
        )
        handle_response(
            await pg.delete("KBWarehouse_Config", {"config_id": uuid.UUID(config_id)})
        )
        return OK({"config_id": config_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/tables/{table_id}",
    response_model=ResponseModel,
    tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_warehouse_config_table(
    warehouse_id: str,
    config_id: str,
    table_id: str,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "DELETE /api/knowledge/warehouses/%s/configs/%s/tables/%s | tenant=%s",
        warehouse_id,
        config_id,
        table_id,
        claims.tenant_id,
    )
    try:
        # Remove a specific table name from the config's selected_tables list
        resolved = await _resolve_warehouse_id(
            claims.tenant_id, uuid.UUID(warehouse_id)
        )
        log.info(
            "service=postgres, method=read, table=KBWarehouse_Config | warehouse_id=%s",
            resolved,
        )
        records = handle_response(
            await pg.read(
                "KBWarehouse_Config",
                {
                    "warehouse_id": resolved,
                },
            )
        )
        cfg_row = next((r for r in records if str(r["config_id"]) == config_id), None)
        if cfg_row is None:
            return ERR(404, f"Config {config_id} not found")
        cfg = cfg_row.get("config") or {}
        cfg["selected_tables"] = [
            t for t in cfg.get("selected_tables", []) if t != table_id
        ]
        log.info(
            "service=postgres, method=update, table=KBWarehouse_Config | config_id=%s, removed_table=%s",
            config_id,
            table_id,
        )
        handle_response(
            await pg.update(
                "KBWarehouse_Config",
                {
                    "config_id": uuid.UUID(config_id),
                    "config": cfg,
                },
            )
        )
        return OK({"config_id": config_id, "removed_table": table_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE HUB — QDRANT tab
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/api/knowledge/qdrant/collections", response_model=ResponseModel, tags=["Qdrant"]
)
async def get_qdrant_collections(claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBQdrantConnection → KBQdrantCollection → KBModel (LEFT)
    to return all collections with their embedding model name.
    """
    log.info("GET /api/knowledge/qdrant/collections | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read_join, query=q_qdrant_collections | tenant=%s",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read_join(q_qdrant_collections(claims.tenant_id))
        )

        return OK(map_qdrant_collections(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/qdrant/collections/{collection_id}",
    response_model=ResponseModel,
    tags=["Qdrant"],
    dependencies=[Depends(require_permission("toggle_qdrant"))],
)
async def toggle_qdrant_collection(
    collection_id: str,
    body: RequestToggleQdrantCollection,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PATCH /api/knowledge/qdrant/collections/%s | tenant=%s, active=%s",
        collection_id,
        claims.tenant_id,
        body.active,
    )
    try:
        log.info(
            "service=postgres, method=update, table=KBQdrantCollection | collection_id=%s, active=%s",
            collection_id,
            body.active,
        )
        handle_response(
            await pg.update(
                "KBQdrantCollection",
                {
                    "collection_id": uuid.UUID(collection_id),
                    "is_active": body.active,
                },
            )
        )
        # Re-fetch full row so the UI can replace its local state with the complete object
        log.info(
            "service=postgres, method=read_join, query=q_qdrant_collection_by_id | collection_id=%s",
            collection_id,
        )
        rows = handle_response(
            await pg.read_join(
                q_qdrant_collection_by_id(claims.tenant_id, uuid.UUID(collection_id))
            )
        )
        if not rows:
            return ERR(404, f"Collection {collection_id} not found after update")
        return OK(map_qdrant_collection(rows[0]))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/qdrant/collections/{collection_id}/search",
    response_model=ResponseModel,
    tags=["Qdrant"],
    dependencies=[Depends(require_permission("toggle_qdrant"))],
)
async def search_qdrant(
    collection_id: str,
    body: RequestSearchQdrant,
    claims: JWTClaims = Depends(parse_jwt),
):
    """
    Scroll the Qdrant collection and return points whose payload text
    contains the query string (case-insensitive, demo-mode search).
    """
    log.info(
        "POST /api/knowledge/qdrant/collections/%s/search | tenant=%s, query=%r",
        collection_id,
        claims.tenant_id,
        (body.query or "")[:80],
    )
    try:
        # Resolve collection name from Postgres registry
        log.info(
            "service=postgres, method=read_join, query=q_qdrant_collection_name | collection_id=%s",
            collection_id,
        )
        rows = handle_response(
            await pg.read_join(
                q_qdrant_collection_name(claims.tenant_id, uuid.UUID(collection_id))
            )
        )
        if not rows:
            return ERR(404, f"Collection {collection_id} not found")
        collection_name = rows[0]["name"]

        q = (body.query or "").lower()
        log.info(
            "service=qdrant, method=scroll | collection=%s, query=%r",
            collection_name,
            q[:80],
        )
        results = []
        offset = None
        while True:
            batch, next_offset = await qd.client.scroll(
                collection_name=collection_name,
                with_payload=True,
                with_vectors=False,
                limit=100,
                offset=offset,
            )
            for point in batch:
                payload = point.payload or {}
                if not q or q in " ".join(str(v) for v in payload.values()).lower():
                    results.append(map_qdrant_point(point))
            if next_offset is None:
                break
            offset = next_offset

        return OK(results)
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE HUB — NEO4J tab
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/api/knowledge/neo4j/graph", response_model=ResponseModel, tags=["Neo4j"])
async def get_neo4j_graph(claims: JWTClaims = Depends(parse_jwt)):
    """
    Return graph nodes and edges scoped to the tenant.
    Nodes come from KBNeo4jNode (Postgres registry) + their Neo4j properties.
    Edges come from KBNeo4jRelationship (Postgres registry).
    """
    log.info("GET /api/knowledge/neo4j/graph | tenant=%s", claims.tenant_id)
    try:
        # Connection for this tenant
        log.info(
            "service=postgres, method=read, table=KBNeo4jConnection | tenant=%s",
            claims.tenant_id,
        )
        conn_rows = handle_response(
            await pg.read("KBNeo4jConnection", {"tenant_id": claims.tenant_id})
        )
        if not conn_rows:
            return OK({"nodes": [], "edges": []})
        conn_id = conn_rows[0]["connection_id"]

        log.info(
            "service=postgres, method=read, table=KBNeo4jNode | connection_id=%s, limit=500",
            conn_id,
        )
        node_rows = handle_response(
            await pg.read("KBNeo4jNode", {"connection_id": conn_id, "limit": 500})
        )

        # Edges — join KBNeo4jNode (FROM side) to KBNeo4jRelationship
        log.info(
            "service=postgres, method=read_join, query=q_neo4j_edges | connection_id=%s",
            conn_id,
        )
        edge_rows = handle_response(await pg.read_join(q_neo4j_edges(conn_id)))

        return OK(map_neo4j_graph(node_rows, edge_rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.get("/api/knowledge/neo4j/schema", response_model=ResponseModel, tags=["Neo4j"])
async def get_neo4j_schema(claims: JWTClaims = Depends(parse_jwt)):
    """Return entity list and connection map for the query builder."""
    log.info("GET /api/knowledge/neo4j/schema | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBNeo4jConnection | tenant=%s",
            claims.tenant_id,
        )
        conn_rows = handle_response(
            await pg.read("KBNeo4jConnection", {"tenant_id": claims.tenant_id})
        )
        if not conn_rows:
            return OK({"entities": [], "connections": {}})
        conn_id = conn_rows[0]["connection_id"]

        log.info(
            "service=postgres, method=read, table=KBNeo4jNode | connection_id=%s, limit=500",
            conn_id,
        )
        node_rows = handle_response(
            await pg.read("KBNeo4jNode", {"connection_id": conn_id, "limit": 500})
        )
        log.info(
            "service=postgres, method=read_join, query=q_neo4j_schema_edges | connection_id=%s",
            conn_id,
        )
        edge_rows = handle_response(await pg.read_join(q_neo4j_schema_edges(conn_id)))

        return OK(build_neo4j_schema(node_rows, edge_rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post("/api/knowledge/neo4j/query", response_model=ResponseModel, tags=["Neo4j"])
async def query_neo4j(body: RequestNeo4jQuery, claims: JWTClaims = Depends(parse_jwt)):
    """Execute a read-only (MATCH) Cypher query scoped to the tenant's graph."""
    log.info(
        "POST /api/knowledge/neo4j/query | tenant=%s, cypher=%r",
        claims.tenant_id,
        body.cypher[:80],
    )
    try:
        if not body.cypher.strip().upper().startswith("MATCH"):
            return ERR(400, "Only MATCH queries are permitted")
        log.info("service=neo4j, method=run_query | cypher=%r", body.cypher[:80])
        result = handle_response(await neo.run_query(body.cypher))
        return OK(result)
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# CONFLICTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/api/knowledge/conflicts", response_model=ResponseModel, tags=["Conflicts"]
)
async def get_conflicts(claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBConflictBatch → KBConflict (LEFT) to return all batches
    with their nested conflicts, bucketed by batch status.

    pending  → list of batches (each has conflicts[])
    awaiting → list of batches (each has conflicts[])
    resolved → list of batches (each has conflicts[])
    """
    log.info("GET /api/knowledge/conflicts | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read_join, query=q_conflicts | tenant=%s",
            claims.tenant_id,
        )
        rows = handle_response(await pg.read_join(q_conflicts(claims.tenant_id)))

        return OK(map_conflict_batches(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.get(
    "/api/knowledge/conflicts/{conflict_id}",
    response_model=ResponseModel,
    tags=["Conflicts"],
)
async def get_conflict_detail(conflict_id: str, claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBConflictBatch → KBConflict (INNER) to return the full
    conflict detail including batch metadata.
    """
    log.info(
        "GET /api/knowledge/conflicts/%s | tenant=%s", conflict_id, claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read_join, query=q_conflict_detail | conflict_id=%s, tenant=%s",
            conflict_id,
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read_join(
                q_conflict_detail(claims.tenant_id, uuid.UUID(conflict_id))
            )
        )

        if not rows:
            return ERR(404, f"Conflict {conflict_id} not found")
        return OK(map_conflict_detail(rows[0]))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/conflicts/{conflict_id}",
    response_model=ResponseModel,
    tags=["Conflicts"],
    dependencies=[Depends(require_permission("edit_conflict"))],
)
async def resolve_conflict(
    conflict_id: str,
    body: RequestResolveConflict,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PATCH /api/knowledge/conflicts/%s | tenant=%s, method=%s",
        conflict_id,
        claims.tenant_id,
        body.selected_resolution_method,
    )
    try:
        is_merge = body.selected_resolution_method.lower() == "merge"
        new_status = "awaiting" if is_merge else "resolved"
        method_val = (
            body.selected_resolution_method.value
            if hasattr(body.selected_resolution_method, "value")
            else str(body.selected_resolution_method)
        )
        log.info(
            "service=postgres, method=update, table=KBConflict | conflict_id=%s, status=%s",
            conflict_id,
            new_status,
        )
        handle_response(
            await pg.update(
                "KBConflict",
                {
                    "conflict_id": uuid.UUID(conflict_id),
                    "status": new_status,
                    "resolution_instruction": body.resolution_instruction,
                    "selected_resolution_method": method_val,
                    "resolved_by": claims.user_id if not is_merge else None,
                    "resolved_at": datetime.now(timezone.utc) if not is_merge else None,
                },
            )
        )
        return OK(
            {
                "conflict_id": conflict_id,
                "status": new_status,
                "selected_resolution_method": method_val,
                "resolution_instruction": body.resolution_instruction,
            }
        )
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# POLICIES
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/api/knowledge/policies/filtering", response_model=ResponseModel, tags=["Policies"]
)
async def get_filter_policies(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/knowledge/policies/filtering | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBFilterPolicy | tenant=%s, limit=100",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBFilterPolicy", {"tenant_id": claims.tenant_id, "limit": 100}
            )
        )
        return OK(map_filter_policies(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/policies/filtering",
    response_model=ResponseModel,
    status_code=201,
    tags=["Policies"],
    dependencies=[Depends(require_permission("add_filtering_policy"))],
)
async def create_filter_policy(
    body: RequestCreateFilterPolicy,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "POST /api/knowledge/policies/filtering | tenant=%s, name=%r, type=%s",
        claims.tenant_id,
        body.name,
        body.type,
    )
    try:
        log.info(
            "service=postgres, method=create, table=KBFilterPolicy | tenant=%s, name=%r",
            claims.tenant_id,
            body.name,
        )
        res = handle_response(
            await pg.create(
                "KBFilterPolicy",
                {
                    "tenant_id": claims.tenant_id,
                    "policy_name": body.name,
                    "configformat": policy_type_to_fmt(body.type),
                    "is_active": True,
                    "created_by": claims.user_id,
                    "config": {
                        "rules": policy_rules_to_list(body.type, body.content),
                        "threshold": 0.8,
                    },
                },
            )
        )
        return CREATED({"policy_id": res.get("policy_id")})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.get(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel,
    tags=["Policies"],
)
async def get_filter_policy(policy_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info(
        "GET /api/knowledge/policies/filtering/%s | tenant=%s",
        policy_id,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBFilterPolicy | tenant=%s, limit=100",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBFilterPolicy", {"tenant_id": claims.tenant_id, "limit": 100}
            )
        )
        match = next((r for r in rows if str(r["policy_id"]) == policy_id), None)
        if match is None:
            return ERR(404, f"Policy {policy_id} not found")
        return OK(map_filter_policy(match))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.put(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel,
    tags=["Policies"],
    dependencies=[Depends(require_permission("edit_filtering_policy"))],
)
async def update_filter_policy(
    policy_id: str,
    body: RequestUpdateFilterPolicy,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PUT /api/knowledge/policies/filtering/%s | tenant=%s",
        policy_id,
        claims.tenant_id,
    )
    try:
        update: dict[str, Any] = {"policy_id": uuid.UUID(policy_id)}
        data = body.model_dump(exclude_none=True)
        if "name" in data:
            update["policy_name"] = data["name"]
        if "type" in data:
            update["configformat"] = policy_type_to_fmt(data["type"])
        if "active" in data:
            update["is_active"] = data["active"]
        if "content" in data:
            t = data.get("type", "natural_language")
            update["config"] = {
                "rules": policy_rules_to_list(t, data["content"]),
                "threshold": 0.8,
            }
        log.info(
            "service=postgres, method=update, table=KBFilterPolicy | policy_id=%s",
            policy_id,
        )
        handle_response(await pg.update("KBFilterPolicy", update))
        return OK({"policy_id": policy_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel,
    tags=["Policies"],
    dependencies=[Depends(require_permission("delete_filtering_policy"))],
)
async def delete_filter_policy(policy_id: str, claims: JWTClaims = Depends(parse_jwt)):
    log.info(
        "DELETE /api/knowledge/policies/filtering/%s | tenant=%s",
        policy_id,
        claims.tenant_id,
    )
    try:
        log.info(
            "service=postgres, method=delete, table=KBFilterPolicy | policy_id=%s",
            policy_id,
        )
        handle_response(
            await pg.delete("KBFilterPolicy", {"policy_id": uuid.UUID(policy_id)})
        )
        return OK({"policy_id": policy_id})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.get(
    "/api/knowledge/policies/extraction",
    response_model=ResponseModel,
    tags=["Policies"],
)
async def get_extraction_policy(claims: JWTClaims = Depends(parse_jwt)):
    log.info("GET /api/knowledge/policies/extraction | tenant=%s", claims.tenant_id)
    try:
        log.info(
            "service=postgres, method=read, table=KBExtractionPolicy | tenant=%s, limit=5",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBExtractionPolicy", {"tenant_id": claims.tenant_id, "limit": 5}
            )
        )
        return OK(map_extraction_policy(rows))
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


@router.put(
    "/api/knowledge/policies/extraction/custom",
    response_model=ResponseModel,
    tags=["Policies"],
    dependencies=[Depends(require_permission("edit_extraction_policy"))],
)
async def update_extraction_policy_custom(
    body: RequestExtractionCustom,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "PUT /api/knowledge/policies/extraction/custom | tenant=%s", claims.tenant_id
    )
    try:
        log.info(
            "service=postgres, method=read, table=KBExtractionPolicy | tenant=%s, limit=5",
            claims.tenant_id,
        )
        rows = handle_response(
            await pg.read(
                "KBExtractionPolicy", {"tenant_id": claims.tenant_id, "limit": 5}
            )
        )
        if not rows:
            return ERR(404, "No extraction policy found for this tenant")
        log.info(
            "service=postgres, method=update, table=KBExtractionPolicy | policy_id=%s",
            rows[0]["policy_id"],
        )
        handle_response(
            await pg.update(
                "KBExtractionPolicy",
                {
                    "policy_id": rows[0]["policy_id"],
                    "custom_override": body.custom,
                },
            )
        )
        return OK({"policy_id": to_string(rows[0]["policy_id"])})
    except Exception as e:
        log.exception(str(e))
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# INGEST / WAREHOUSE CONNECT (not yet implemented)
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/api/knowledge/data_upload", response_model=ResponseModel, tags=["Data"])
async def upload_data(body: RequestDataUpload, claims: JWTClaims = Depends(parse_jwt)):
    log.info("POST /api/knowledge/data_upload | tenant=%s", claims.tenant_id)
    return ERR(501, "Not implemented")


@router.post(
    "/api/knowledge/confirm/{upload_id}", response_model=ResponseModel, tags=["Data"]
)
async def confirm_upload(
    upload_id: uuid.UUID,
    body: RequestConfirmDataUpload,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info("POST /api/knowledge/confirm/%s | tenant=%s", upload_id, claims.tenant_id)
    return ERR(501, "Not implemented")


@router.post("/api/knowledge/connect", response_model=ResponseModel, tags=["Warehouse"])
async def connect_warehouse(
    body: RequestConnectWarehouse, claims: JWTClaims = Depends(parse_jwt)
):
    log.info("POST /api/knowledge/connect | tenant=%s", claims.tenant_id)
    return ERR(501, "Not implemented")


@router.post(
    "/api/knowledge/select_table/{connection_id}",
    response_model=ResponseModel,
    tags=["Warehouse"],
)
async def select_tables(
    connection_id: uuid.UUID,
    body: RequestSelectTable,
    claims: JWTClaims = Depends(parse_jwt),
):
    log.info(
        "POST /api/knowledge/select_table/%s | tenant=%s",
        connection_id,
        claims.tenant_id,
    )
    return ERR(501, "Not implemented")
