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
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

import services.database_connector.postgres.db_client as pg
import services.database_connector.qdrant.db_client as qd
import services.database_connector.neo4j.db_client as neo
from services.database_connector.db_config import DBConfig
from neo4j import AsyncGraphDatabase

from basemodel.API_response import ResponseModel, Error
from basemodel.conflict import RequestResolveConflict
from basemodel.data import RequestUpdateDocument, RequestDataUpload, RequestConfirmDataUpload
from basemodel.knowledge import (
    RequestActivateChunkVersion,
    RequestCreateChunkVersion,
    RequestDocConfig,
    RequestNeo4jQuery,
    RequestSearchQdrant,
    RequestTableRowUpdate,
    RequestToggleQdrantCollection,
    RequestWarehouseConfigCreate,
)
from basemodel.policy import RequestCreateFilterPolicy, RequestExtractionCustom, RequestUpdateFilterPolicy
from basemodel.warehouse import RequestConnectWarehouse, RequestSelectTable


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
        "delete_data", "edit_conflict", "process_layer", "add_data", "add_warehouse",
        "add_filtering_policy", "edit_filtering_policy", "delete_filtering_policy",
        "edit_extraction_policy", "toggle_qdrant", "add_warehouse_config",
        "edit_warehouse_config", "add_chunk_version",
    },
    "AI_ENGINEER": {"toggle_qdrant", "edit_extraction_policy", "add_chunk_version"},
    "BUSINESS_OPERATOR": {"add_warehouse", "add_warehouse_config", "edit_warehouse_config"},
    "EXECUTIVE": {"edit_conflict", "process_layer", "add_filtering_policy"},
}

# ── Display-value mappers (DB storage → UI display) ──────────────────────────

_CONFLICT_TYPE_DISPLAY: dict[str, str] = {
    "content_contradiction": "Content Contradiction",
    "content_conflict": "Content Conflict",
    "content_duplicate": "Content Duplicate",
    "content_update": "Content Update",
    "table_schema": "Table Schema",
}
_SEVERITY_DISPLAY: dict[str, str] = {"high": "High", "medium": "Medium", "low": "Low"}

# DB stores "Natural Language" / "Exact Match For Word or Phrase"; UI uses 'natural_language' / 'exact_word'
_POLICY_FMT_TO_TYPE: dict[str, str] = {
    "Natural Language": "natural_language",
    "Exact Match For Word or Phrase": "exact_word",
}
_POLICY_TYPE_TO_FMT: dict[str, str] = {v: k for k, v in _POLICY_FMT_TO_TYPE.items()}


# UTILITIES

# permission validation
def require_permission(*perms: str):
    def _dep(claims: JWTClaims = Depends(parse_jwt)):
        allowed = ROLE_PERMISSIONS.get(claims.role, set())
        for p in perms:
            if p not in allowed:
                raise HTTPException(
                    status_code=403,
                    detail={"error": f"Role {claims.role!r} lacks permission: {p}", "required": p},
                )

    return _dep


# Handler for services response
def response_code_handler(res) -> Any:
    if res.code >= 400:
        raise ValueError(res.error or f"DB error {res.code}")
    return res.data if res.data is not None else []


# convert some db data to string for display
def to_string(v) -> str:
    return str(v) if v is not None else ""


def conflict_type_mapping(v: str) -> str:
    return _CONFLICT_TYPE_DISPLAY.get(v, v)


def conflict_severity_mapping(v: str) -> str:
    return _SEVERITY_DISPLAY.get(v, v)


def extracting_policy_UI_to_type(fmt: str) -> str:
    return _POLICY_FMT_TO_TYPE.get(fmt, "natural_language")


def extracting_policy_type_to_UI(t: str) -> str:
    return _POLICY_TYPE_TO_FMT.get(t, "Natural Language")


def policy_rule_list_to_str(fmt: str, rules: list) -> str:
    """Convert stored rules list to the string format the UI expects."""
    if _POLICY_FMT_TO_TYPE.get(fmt) == "exact_word":
        return json.dumps(rules)
    return " ".join(str(r) for r in rules) if rules else ""


def policy_rules_str_to_list(policy_type: str, content: str) -> list:
    """Convert UI content string back to a rules list for DB storage."""
    if policy_type == "exact_word":
        try:
            return json.loads(content)
        except Exception:
            return [content]
    return [content]


def _map_doc(row: dict) -> dict:
    """Convert a KBData DB row to the KnowledgeDocument shape the UI expects."""
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}

    st = row.get("source_type", "doc")
    ext = (row.get("extension") or "").upper()
    doc_type = (
        f"Doc/{ext}" if st == "doc" and ext else
        "Web" if st == "web" else
        f"Image/{ext}" if ext else "Image" if st == "image" else
        f"Video/{ext}" if ext else "Video" if st == "video" else
        f"Warehouse/{meta.get('warehouseType', '')}" if st == "warehouse" else
        st
    )
    tier = (row.get("current_tier") or "bronze").lower()
    return {
        "id": to_string(row["data_id"]),
        "name": row.get("name", ""),
        "layer": tier.upper(),
        "status": {"gold": "PUBLISHED", "silver": "EMBEDDING"}.get(tier, "RAW"),
        "version": "v1.0",
        "author": meta.get("author") or to_string(row.get("added_by")),
        "lastUpdated": to_string(row.get("added_on", "")),
        "metadata": {
            "type": doc_type,
            "language": row.get("language"),
            "accessRole": meta.get("access_role") or meta.get("accessRole"),
            "url": meta.get("url"),
            "author": meta.get("author"),
            "publishedDate": meta.get("published_date") or meta.get("publishedDate"),
            "warehouseType": meta.get("warehouseType") or meta.get("warehouse_type"),
            "width": meta.get("width"),
            "height": meta.get("height"),
            "colorSpace": meta.get("color_space") or meta.get("colorSpace"),
            "fileSize": meta.get("file_size") or meta.get("fileSize"),
            "totalFrame": meta.get("total_frame") or meta.get("totalFrame"),
        },
    }


def OK(data: Any) -> ResponseModel:
    return ResponseModel(code=200, data=data)


def CREATED(data: Any) -> ResponseModel:
    return ResponseModel(code=201, data=data)


def ERR(code: int, msg: str) -> ResponseModel:
    return ResponseModel(code=code, error=Error(message=msg, error_type="Error"))


router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# FLEET
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/fleet/stats", response_model=ResponseModel, tags=["Fleet"])
async def get_fleet_stats(claims: JWTClaims = Depends(parse_jwt)):
    try:
        # Gold document counts by source_type
        gold_docs = response_code_handler(await pg.read("KBData", {
            "tenant_id": claims.tenant_id,
            "current_tier": "gold",
            "limit": 1000,
        }))
        counts: dict[str, int] = {}
        for d in gold_docs:
            st = d.get("source_type", "doc")
            counts[st] = counts.get(st, 0) + 1

        # Qdrant collection count — join Connection → Collection
        qdrant_rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBQdrantConnection", "KBQdrantCollection"],
            "join_on": [{
                "left_table": "KBQdrantConnection", "left_column": "connection_id",
                "right_table": "KBQdrantCollection", "right_column": "connection_id",
                "join_type": "INNER",
            }],
            "selected_columns": [
                {"table_name": "KBQdrantCollection", "column_name": "collection_id", "alias": "id"},
            ],
            "filters": [
                {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": claims.tenant_id},
            ],
            "limit": 200,
        }))

        # Neo4j totals
        neo_conns = response_code_handler(await pg.read("KBNeo4jConnection", {"tenant_id": claims.tenant_id}))
        total_nodes = sum(r.get("total_node", 0) for r in neo_conns)
        total_edges = sum(r.get("total_edge", 0) for r in neo_conns)

        # Unresolved conflict batches
        batches = response_code_handler(await pg.read("KBConflictBatch", {"tenant_id": claims.tenant_id, "limit": 500}))
        unresolved = sum(1 for b in batches if b.get("status") in ("pending", "awaiting"))

        return OK({
            "content": {
                "documents": counts.get("doc", 0),
                "web": counts.get("web", 0),
                "media": counts.get("image", 0) + counts.get("video", 0),
                "warehouses": counts.get("warehouse", 0),
            },
            "qdrant_collections": len(qdrant_rows),
            "neo4j_nodes": total_nodes,
            "neo4j_relationships": total_edges,
            "unresolved_conflict_batches": unresolved,
        })
    except Exception as e:
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# DATA / INVENTORY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/data/documents", response_model=ResponseModel, tags=["Data"])
async def get_documents(claims: JWTClaims = Depends(parse_jwt)):
    """Return all documents for the tenant across all layers."""
    try:
        rows = response_code_handler(await pg.read("KBData", {"tenant_id": claims.tenant_id, "limit": 200}))
        return OK([_map_doc(r) for r in rows])
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/data/documents/{doc_id}",
    response_model=ResponseModel, tags=["Data"],
    dependencies=[Depends(require_permission("process_layer"))],
)
async def update_document(
        doc_id: str,
        body: RequestUpdateDocument,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        update: dict[str, Any] = {"data_id": uuid.UUID(doc_id)}
        if body.layer:
            update["current_tier"] = body.layer.lower()
        if body.metadata:
            update["metadata"] = body.metadata
        response_code_handler(await pg.update("KBData", update))
        return OK({"doc_id": doc_id})
    except KeyError:
        return ERR(404, f"Document {doc_id} not found")
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/data/documents/{doc_id}",
    response_model=ResponseModel, tags=["Data"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_document(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        response_code_handler(await pg.delete("KBData", {"data_id": uuid.UUID(doc_id)}))
        return OK({"doc_id": doc_id})
    except Exception as e:
        return ERR(500, str(e))


# ── Stub endpoints (Agents / Deployments not in KB schema yet) ─────────────────

@router.get("/api/data/agents", response_model=ResponseModel, tags=["Data"])
async def get_agents(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


@router.get("/api/data/traces", response_model=ResponseModel, tags=["Data"])
async def get_traces(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


@router.get("/api/data/configs", response_model=ResponseModel, tags=["Data"])
async def get_agent_configs(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


@router.get("/api/data/runs", response_model=ResponseModel, tags=["Data"])
async def get_runs(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


@router.get("/api/data/deployments", response_model=ResponseModel, tags=["Data"])
async def get_deployments(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


@router.get("/api/data/environments", response_model=ResponseModel, tags=["Data"])
async def get_environments(claims: JWTClaims = Depends(parse_jwt)):
    return OK([])


# ═══════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE HUB — DATABASE tab (Gold documents, chunks, tables, configs)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/knowledge/documents", response_model=ResponseModel, tags=["Knowledge"])
async def get_kg_documents(claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read("KBData", {
            "tenant_id": claims.tenant_id,
            "current_tier": "gold",
            "limit": 200,
        }))
        return OK([_map_doc(r) for r in rows])
    except Exception as e:
        return ERR(500, str(e))


@router.get("/api/knowledge/documents/{doc_id}", response_model=ResponseModel, tags=["Knowledge"])
async def get_kg_document(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read("KBData", {
            "tenant_id": claims.tenant_id,
            "data_id": uuid.UUID(doc_id),
            "limit": 1,
        }))
        if not rows:
            return ERR(404, f"Document {doc_id} not found")
        return OK(_map_doc(rows[0]))
    except Exception as e:
        return ERR(500, str(e))


# ── Chunks ────────────────────────────────────────────────────────────────────

@router.get("/api/knowledge/documents/{doc_id}/chunks", response_model=ResponseModel, tags=["Knowledge"])
async def get_chunks(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBTextBlock", "KBTextBlockVersion"],
            "join_on": [{
                "left_table": "KBTextBlock", "left_column": "block_id",
                "right_table": "KBTextBlockVersion", "right_column": "block_id",
                "join_type": "LEFT",
            }],
            "selected_columns": [
                {"table_name": "KBTextBlock", "column_name": "block_id", "alias": "block_id"},
                {"table_name": "KBTextBlock", "column_name": "block_index", "alias": "block_index"},
                {"table_name": "KBTextBlockVersion", "column_name": "version_id", "alias": "version_id"},
                {"table_name": "KBTextBlockVersion", "column_name": "version_number", "alias": "version_number"},
                {"table_name": "KBTextBlockVersion", "column_name": "content", "alias": "content"},
                {"table_name": "KBTextBlockVersion", "column_name": "is_active", "alias": "is_active"},
                {"table_name": "KBTextBlockVersion", "column_name": "created_at", "alias": "created_at"},
                {"table_name": "KBTextBlockVersion", "column_name": "payload", "alias": "payload"},
                {"table_name": "KBTextBlockVersion", "column_name": "embedding_model_id",
                 "alias": "embedding_model_id"},
            ],
            "filters": [
                {"table_name": "KBTextBlock", "column_name": "owner_id", "value": uuid.UUID(doc_id)},
            ],
            "order_by": "KBTextBlock.block_index ASC, KBTextBlockVersion.version_number ASC",
            "limit": 500,
        }))

        blocks: dict[str, dict] = {}
        for r in rows:
            bid = to_string(r["block_id"])
            if bid not in blocks:
                blocks[bid] = {
                    "id": bid,
                    "title": f"Chunk {r['block_index'] + 1}",
                    "text": "",
                    "versions": [],
                }
            if r.get("version_id") is None:
                continue
            _raw_payload = r.get("payload")
            if isinstance(_raw_payload, str):
                try:
                    payload = json.loads(_raw_payload)
                except Exception:
                    payload = {}
            else:
                payload = _raw_payload or {}
            version = {
                "version_number": to_string(r["version_number"]),
                "create_at": to_string(r.get("created_at", "")),
                "status": "active" if r.get("is_active") else "inactive",
                "embedding_models": to_string(r.get("embedding_model_id", "")),
                "entities": payload.get("entities", []),
                "intent": ", ".join(payload.get("intents", [])),
                "text": r.get("content") or "",
            }
            blocks[bid]["versions"].append(version)
            if r.get("is_active"):
                blocks[bid]["text"] = r.get("content") or ""

        return OK(list(blocks.values()))
    except Exception as e:
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions",
    response_model=ResponseModel, status_code=201, tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_chunk_version"))],
)
async def create_chunk_version(
        doc_id: str,
        chunk_id: str,
        body: RequestCreateChunkVersion,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        chunk_uuid = uuid.UUID(chunk_id)
        existing = response_code_handler(await pg.read("KBTextBlockVersion", {"block_id": chunk_uuid}))
        next_num = max((v["version_number"] for v in existing), default=0) + 1
        res = response_code_handler(await pg.create("KBTextBlockVersion", {
            "block_id": chunk_uuid,
            "version_number": next_num,
            "content": body.text,
            "created_by": claims.user_id,
        }))
        return CREATED({"version_id": res.get("version_id"), "version_number": next_num})
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/activate",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_chunk_version"))],
)
async def activate_chunk_version(
        doc_id: str,
        chunk_id: str,
        body: RequestActivateChunkVersion,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        chunk_uuid = uuid.UUID(chunk_id)
        versions = response_code_handler(await pg.read("KBTextBlockVersion", {"block_id": chunk_uuid}))
        target = next(
            (v for v in versions if str(v["version_number"]) == str(body.version_number)), None
        )
        if target is None:
            return ERR(404, f"Version {body.version_number} not found for chunk {chunk_id}")

        # Deactivate every currently-active version for this block
        for v in versions:
            if v.get("is_active"):
                await pg.update("KBTextBlockVersion", {
                    "version_id": v["version_id"],
                    "is_active": False,
                })

        response_code_handler(await pg.update("KBTextBlockVersion", {
            "version_id": target["version_id"],
            "is_active": True,
        }))
        return OK({"version_id": to_string(target["version_id"])})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions/{version_number}",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_chunk_version(
        doc_id: str,
        chunk_id: str,
        version_number: str,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        versions = response_code_handler(await pg.read("KBTextBlockVersion", {"block_id": uuid.UUID(chunk_id)}))
        target = next((v for v in versions if str(v["version_number"]) == version_number), None)
        if target is None:
            return ERR(404, f"Version {version_number} not found")
        response_code_handler(await pg.delete("KBTextBlockVersion", {"version_id": target["version_id"]}))
        return OK({"version_id": to_string(target["version_id"])})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/chunks/{chunk_id}",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_chunk(doc_id: str, chunk_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        response_code_handler(await pg.delete("KBTextBlock", {"block_id": uuid.UUID(chunk_id)}))
        return OK({"chunk_id": chunk_id})
    except Exception as e:
        return ERR(500, str(e))


# ── Tables ────────────────────────────────────────────────────────────────────

@router.get("/api/knowledge/documents/{doc_id}/tables", response_model=ResponseModel, tags=["Knowledge"])
async def get_tables(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBTextBlock → KBTextBlockVersion → KBTextTable
    to return only active, table-bearing block versions.
    """
    try:
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBTextBlock", "KBTextBlockVersion", "KBTextTable"],
            "join_on": [
                {
                    "left_table": "KBTextBlock", "left_column": "block_id",
                    "right_table": "KBTextBlockVersion", "right_column": "block_id",
                    "join_type": "INNER",
                },
                {
                    "left_table": "KBTextBlockVersion", "left_column": "version_id",
                    "right_table": "KBTextTable", "right_column": "version_id",
                    "join_type": "INNER",
                },
            ],
            "selected_columns": [
                {"table_name": "KBTextBlockVersion", "column_name": "version_id", "alias": "id"},
                {"table_name": "KBTextTable", "column_name": "table_name", "alias": "table_name"},
                {"table_name": "KBTextTable", "column_name": "description", "alias": "description"},
                {"table_name": "KBTextTable", "column_name": "data", "alias": "data"},
            ],
            "filters": [
                {"table_name": "KBTextBlock", "column_name": "owner_id", "value": uuid.UUID(doc_id)},
                {"table_name": "KBTextBlockVersion", "column_name": "is_active", "value": True},
                {"table_name": "KBTextBlockVersion", "column_name": "table_involved", "value": True},
            ],
            "order_by": "KBTextBlock.block_index ASC",
            "limit": 100,
        }))

        def _parse_data(r) -> dict:
            raw = r.get("data")
            if isinstance(raw, str):
                try:
                    return json.loads(raw)
                except Exception:
                    return {}
            return raw or {}

        def _normalize(r) -> dict:
            data = _parse_data(r)
            raw_cols = data.get("columns", [])
            raw_rows = data.get("rows", [])
            # Columns: lift plain strings → {name, type, nullable}
            if raw_cols and isinstance(raw_cols[0], str):
                columns = [{"name": c, "type": "TEXT", "nullable": True} for c in raw_cols]
            else:
                columns = raw_cols
            # Rows: lift arrays → {colName: value} dicts
            col_names = [c if isinstance(c, str) else c.get("name", "") for c in raw_cols]
            if raw_rows and isinstance(raw_rows[0], list):
                rows = [dict(zip(col_names, row)) for row in raw_rows]
            else:
                rows = raw_rows
            return {
                "id": to_string(r["id"]),
                "name": r.get("table_name") or "",
                "description": r.get("description") or "",
                "columns": columns,
                "rows": rows,
            }

        return OK([_normalize(r) for r in rows])
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/tables/{table_id}/rows/{row_index}",
    response_model=ResponseModel, tags=["Knowledge"],
)
async def update_table_row(
        doc_id: str,
        table_id: str,
        row_index: int,
        body: RequestTableRowUpdate,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        records = response_code_handler(await pg.read("KBTextTable", {"version_id": uuid.UUID(table_id)}))
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
        response_code_handler(await pg.update("KBTextTable", {"version_id": uuid.UUID(table_id), "data": data}))
        return OK({"row_index": row_index, "column": body.column, "value": body.value})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/documents/{doc_id}/tables/{table_id}",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_table(doc_id: str, table_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        response_code_handler(await pg.delete("KBTextTable", {"version_id": uuid.UUID(table_id)}))
        return OK({"table_id": table_id})
    except Exception as e:
        return ERR(500, str(e))


# ── Warehouse document configs (per-doc CONFIGS tab) ──────────────────────────

@router.get("/api/knowledge/documents/{doc_id}/configs", response_model=ResponseModel, tags=["Knowledge"])
async def get_doc_configs(doc_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        doc_rows = response_code_handler(await pg.read("KBData", {
            "tenant_id": claims.tenant_id,
            "data_id": uuid.UUID(doc_id),
            "limit": 1,
        }))
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
        return ERR(500, str(e))


@router.post("/api/knowledge/documents/{doc_id}/configs", response_model=ResponseModel, tags=["Knowledge"])
async def create_doc_config(
        doc_id: str,
        body: RequestDocConfig,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        doc_rows = response_code_handler(await pg.read("KBData", {
            "tenant_id": claims.tenant_id,
            "data_id": uuid.UUID(doc_id),
            "limit": 1,
        }))
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
        return await _create_warehouse_config(uuid.UUID(str(warehouse_id)), body, claims)
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/documents/{doc_id}/configs/{config_id}/activate",
    response_model=ResponseModel, tags=["Knowledge"],
)
async def activate_doc_config(doc_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        response_code_handler(await pg.update("KBWarehouse_Config", {
            "config_id": uuid.UUID(config_id),
            "is_active": True,
        }))
        return OK({"config_id": config_id})
    except Exception as e:
        return ERR(500, str(e))


# ── Warehouse ID resolution ───────────────────────────────────────────────────

async def _resolve_warehouse_id(tenant_id: uuid.UUID, candidate: uuid.UUID) -> uuid.UUID:
    """
    The UI passes the KBData doc_id to warehouse endpoints.
    Resolve it to the actual KBWarehouse.warehouse_id stored in the doc's metadata.
    Falls back to the candidate itself when no mapping is found.
    """
    try:
        rows = response_code_handler(
            await pg.read("KBData", {"tenant_id": tenant_id, "data_id": candidate, "limit": 1}))
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
    rows = response_code_handler(await pg.read("KBWarehouse_Config", {"warehouse_id": warehouse_id}))
    result = []
    for r in rows:
        cfg = r.get("config") or {}
        result.append({
            "id": to_string(r["config_id"]),
            "version": r.get("version_number"),
            "active": bool(r.get("is_active", False)),
            "host": cfg.get("host"),
            "database": cfg.get("database"),
            "selected_tables": cfg.get("selected_tables", []),
            "sync_schedule": cfg.get("sync_schedule"),
            "schema_filter": cfg.get("schema_filter", []),
            "created_at": to_string(r.get("created_at", "")),
        })
    return OK(result)


async def _create_warehouse_config(
        warehouse_id: uuid.UUID,
        body: RequestWarehouseConfigCreate,
        claims: JWTClaims,
) -> ResponseModel:
    tables = [
        (t.get("table_name") or t.get("id") or t) if isinstance(t, dict) else t
        for t in (body.tables or [])
    ]
    res = response_code_handler(await pg.create("KBWarehouse_Config", {
        "warehouse_id": warehouse_id,
        "version_number": int(body.version or 1),
        "is_active": False,
        "created_by": claims.user_id,
        "config": {
            "selected_tables": tables,
            "sync_schedule": body.sync_schedule or "Manual",
        },
    }))
    return CREATED({"config_id": res.get("config_id")})


@router.get(
    "/api/knowledge/warehouses/{warehouse_id}/configs",
    response_model=ResponseModel, tags=["Knowledge"],
)
async def get_warehouse_configs(warehouse_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        resolved = await _resolve_warehouse_id(claims.tenant_id, uuid.UUID(warehouse_id))
        return await _get_warehouse_configs(resolved)
    except Exception as e:
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/warehouses/{warehouse_id}/configs",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("add_warehouse_config"))],
)
async def create_warehouse_config(
        warehouse_id: str,
        body: RequestWarehouseConfigCreate,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        resolved = await _resolve_warehouse_id(claims.tenant_id, uuid.UUID(warehouse_id))
        return await _create_warehouse_config(resolved, body, claims)
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/activate",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("edit_warehouse_config"))],
)
async def activate_warehouse_config(
        warehouse_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    try:
        resolved = await _resolve_warehouse_id(claims.tenant_id, uuid.UUID(warehouse_id))
        response_code_handler(await pg.update("KBWarehouse_Config", {
            "config_id": uuid.UUID(config_id),
            "is_active": True,
        }))
        return OK({"config_id": config_id, "warehouse_id": str(resolved)})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_warehouse_config(
        warehouse_id: str, config_id: str, claims: JWTClaims = Depends(parse_jwt)
):
    try:
        response_code_handler(await pg.delete("KBWarehouse_Config", {"config_id": uuid.UUID(config_id)}))
        return OK({"config_id": config_id})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/tables/{table_id}",
    response_model=ResponseModel, tags=["Knowledge"],
    dependencies=[Depends(require_permission("delete_data"))],
)
async def delete_warehouse_config_table(
        warehouse_id: str, config_id: str, table_id: str,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        # Remove a specific table name from the config's selected_tables list
        resolved = await _resolve_warehouse_id(claims.tenant_id, uuid.UUID(warehouse_id))
        records = response_code_handler(await pg.read("KBWarehouse_Config", {
            "warehouse_id": resolved,
        }))
        cfg_row = next((r for r in records if str(r["config_id"]) == config_id), None)
        if cfg_row is None:
            return ERR(404, f"Config {config_id} not found")
        cfg = cfg_row.get("config") or {}
        cfg["selected_tables"] = [t for t in cfg.get("selected_tables", []) if t != table_id]
        response_code_handler(await pg.update("KBWarehouse_Config", {
            "config_id": uuid.UUID(config_id),
            "config": cfg,
        }))
        return OK({"config_id": config_id, "removed_table": table_id})
    except Exception as e:
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE HUB — QDRANT tab
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/knowledge/qdrant/collections", response_model=ResponseModel, tags=["Qdrant"])
async def get_qdrant_collections(claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBQdrantConnection → KBQdrantCollection → KBModel (LEFT)
    to return all collections with their embedding model name.
    """
    try:
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBQdrantConnection", "KBQdrantCollection", "KBModel"],
            "join_on": [
                {
                    "left_table": "KBQdrantConnection", "left_column": "connection_id",
                    "right_table": "KBQdrantCollection", "right_column": "connection_id",
                    "join_type": "INNER",
                },
                {
                    "left_table": "KBQdrantCollection", "left_column": "embedding_model_id",
                    "right_table": "KBModel", "right_column": "model_id",
                    "join_type": "LEFT",
                },
            ],
            "selected_columns": [
                {"table_name": "KBQdrantCollection", "column_name": "collection_id", "alias": "id"},
                {"table_name": "KBQdrantCollection", "column_name": "collection_name", "alias": "name"},
                {"table_name": "KBQdrantCollection", "column_name": "is_active", "alias": "active"},
                {"table_name": "KBQdrantCollection", "column_name": "points_count", "alias": "points"},
                {"table_name": "KBQdrantCollection", "column_name": "vector_dimension", "alias": "dimensions"},
                {"table_name": "KBQdrantCollection", "column_name": "similarity_metric", "alias": "distance"},
                {"table_name": "KBModel", "column_name": "model_name", "alias": "embedding_model"},
            ],
            "filters": [
                {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": claims.tenant_id},
            ],
            "order_by": "KBQdrantCollection.collection_name ASC",
            "limit": 100,
        }))

        return OK([
            {
                "id": to_string(r["id"]),
                "name": r.get("name"),
                "active": bool(r.get("active", False)),
                "points": r.get("points", 0),
                "dimensions": r.get("dimensions") or 0,
                "distance": r.get("distance", "cosine"),
                "indexed": 100 if r.get("active") else 0,
                "embedding_model": r.get("embedding_model"),
            }
            for r in rows
        ])
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/qdrant/collections/{collection_id}",
    response_model=ResponseModel, tags=["Qdrant"],
    dependencies=[Depends(require_permission("toggle_qdrant"))],
)
async def toggle_qdrant_collection(
        collection_id: str,
        body: RequestToggleQdrantCollection,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        response_code_handler(await pg.update("KBQdrantCollection", {
            "collection_id": uuid.UUID(collection_id),
            "is_active": body.active,
        }))
        # Re-fetch full row so the UI can replace its local state with the complete object
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBQdrantConnection", "KBQdrantCollection", "KBModel"],
            "join_on": [
                {
                    "left_table": "KBQdrantConnection", "left_column": "connection_id",
                    "right_table": "KBQdrantCollection", "right_column": "connection_id",
                    "join_type": "INNER",
                },
                {
                    "left_table": "KBQdrantCollection", "left_column": "embedding_model_id",
                    "right_table": "KBModel", "right_column": "model_id",
                    "join_type": "LEFT",
                },
            ],
            "selected_columns": [
                {"table_name": "KBQdrantCollection", "column_name": "collection_id", "alias": "id"},
                {"table_name": "KBQdrantCollection", "column_name": "collection_name", "alias": "name"},
                {"table_name": "KBQdrantCollection", "column_name": "is_active", "alias": "active"},
                {"table_name": "KBQdrantCollection", "column_name": "points_count", "alias": "points"},
                {"table_name": "KBQdrantCollection", "column_name": "vector_dimension", "alias": "dimensions"},
                {"table_name": "KBQdrantCollection", "column_name": "similarity_metric", "alias": "distance"},
                {"table_name": "KBModel", "column_name": "model_name", "alias": "embedding_model"},
            ],
            "filters": [
                {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": claims.tenant_id},
                {"table_name": "KBQdrantCollection", "column_name": "collection_id", "value": uuid.UUID(collection_id)},
            ],
            "limit": 1,
        }))
        if not rows:
            return ERR(404, f"Collection {collection_id} not found after update")
        r = rows[0]
        return OK({
            "id": to_string(r["id"]),
            "name": r.get("name"),
            "active": bool(r.get("active", False)),
            "points": r.get("points", 0),
            "dimensions": r.get("dimensions") or 0,
            "distance": r.get("distance", "cosine"),
            "indexed": 100 if r.get("active") else 0,
            "embedding_model": r.get("embedding_model"),
        })
    except Exception as e:
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/qdrant/collections/{collection_id}/search",
    response_model=ResponseModel, tags=["Qdrant"],
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
    try:
        # Resolve collection name from Postgres registry
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBQdrantConnection", "KBQdrantCollection"],
            "join_on": [{
                "left_table": "KBQdrantConnection", "left_column": "connection_id",
                "right_table": "KBQdrantCollection", "right_column": "connection_id",
                "join_type": "INNER",
            }],
            "selected_columns": [
                {"table_name": "KBQdrantCollection", "column_name": "collection_name", "alias": "name"},
            ],
            "filters": [
                {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": claims.tenant_id},
                {"table_name": "KBQdrantCollection", "column_name": "collection_id", "value": uuid.UUID(collection_id)},
            ],
            "limit": 1,
        }))
        if not rows:
            return ERR(404, f"Collection {collection_id} not found")
        collection_name = rows[0]["name"]

        q = (body.query or "").lower()
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
                    results.append({
                        "point_id": to_string(point.id),
                        "score": 1.0,
                        "summary": payload.get("summary", ""),
                        "entities": payload.get("entities", []),
                        "intent": payload.get("intents", []),
                    })
            if next_offset is None:
                break
            offset = next_offset

        return OK(results)
    except Exception as e:
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
    try:
        # Connection for this tenant
        conn_rows = response_code_handler(await pg.read("KBNeo4jConnection", {"tenant_id": claims.tenant_id}))
        if not conn_rows:
            return OK({"nodes": [], "edges": []})
        conn_id = conn_rows[0]["connection_id"]

        # Nodes from Postgres registry
        node_rows = response_code_handler(await pg.read("KBNeo4jNode", {"connection_id": conn_id, "limit": 500}))
        node_id_set = {to_string(n["node_id"]) for n in node_rows}

        # Edges — join KBNeo4jNode (FROM side) to KBNeo4jRelationship
        edge_rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBNeo4jNode", "KBNeo4jRelationship"],
            "join_on": [{
                "left_table": "KBNeo4jNode", "left_column": "node_id",
                "right_table": "KBNeo4jRelationship", "right_column": "from_node",
                "join_type": "INNER",
            }],
            "selected_columns": [
                {"table_name": "KBNeo4jRelationship", "column_name": "from_node", "alias": "from_id"},
                {"table_name": "KBNeo4jRelationship", "column_name": "to_node", "alias": "to_id"},
                {"table_name": "KBNeo4jRelationship", "column_name": "description", "alias": "description"},
                {"table_name": "KBNeo4jRelationship", "column_name": "score", "alias": "score"},
            ],
            "filters": [
                {"table_name": "KBNeo4jNode", "column_name": "connection_id", "value": conn_id},
            ],
            "limit": 1000,
        }))

        return OK({
            "nodes": [
                {
                    "id": to_string(n["node_id"]),
                    "name": n.get("node_name"),
                    "description": n.get("node_description"),
                }
                for n in node_rows
            ],
            "edges": [
                {
                    "from": to_string(e["from_id"]),
                    "to": to_string(e["to_id"]),
                    "description": e.get("description"),
                    "score": e.get("score"),
                }
                for e in edge_rows
                if to_string(e.get("to_id")) in node_id_set  # guard: to-node belongs to tenant
            ],
        })
    except Exception as e:
        return ERR(500, str(e))


@router.post("/api/knowledge/neo4j/query", response_model=ResponseModel, tags=["Neo4j"])
async def query_neo4j(body: RequestNeo4jQuery, claims: JWTClaims = Depends(parse_jwt)):
    """Execute a read-only (MATCH) Cypher query scoped to the tenant's graph."""
    try:
        if not body.cypher.strip().upper().startswith("MATCH"):
            return ERR(400, "Only MATCH queries are permitted")
        driver = AsyncGraphDatabase.driver(
            DBConfig.NEO4J_URI,
            auth=(DBConfig.NEO4J_USER, DBConfig.NEO4J_PASSWORD),
        )
        try:
            async with driver.session() as session:
                result = await session.run(body.cypher)
                data = await result.data()
        finally:
            await driver.close()
        return OK(data)
    except Exception as e:
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# CONFLICTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/knowledge/conflicts", response_model=ResponseModel, tags=["Conflicts"])
async def get_conflicts(claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBConflictBatch → KBConflict (LEFT) to return all batches
    with their nested conflicts, bucketed by batch status.

    pending  → list of batches (each has conflicts[])
    awaiting → list of batches (each has conflicts[])
    resolved → list of batches (each has conflicts[])
    """
    try:
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBConflictBatch", "KBConflict"],
            "join_on": [{
                "left_table": "KBConflictBatch", "left_column": "batch_id",
                "right_table": "KBConflict", "right_column": "batch_id",
                "join_type": "LEFT",
            }],
            "selected_columns": [
                {"table_name": "KBConflictBatch", "column_name": "batch_id", "alias": "batch_id"},
                {"table_name": "KBConflictBatch", "column_name": "batch_title", "alias": "batch_title"},
                {"table_name": "KBConflictBatch", "column_name": "status", "alias": "batch_status"},
                {"table_name": "KBConflictBatch", "column_name": "created_at", "alias": "batch_created_at"},
                {"table_name": "KBConflict", "column_name": "conflict_id", "alias": "conflict_id"},
                {"table_name": "KBConflict", "column_name": "conflict_type", "alias": "conflict_type"},
                {"table_name": "KBConflict", "column_name": "severity", "alias": "severity"},
                {"table_name": "KBConflict", "column_name": "status", "alias": "conflict_status"},
                {"table_name": "KBConflict", "column_name": "detected_at", "alias": "detected_at"},
            ],
            "filters": [
                {"table_name": "KBConflictBatch", "column_name": "tenant_id", "value": claims.tenant_id},
            ],
            "order_by": "KBConflictBatch.created_at DESC, KBConflict.detected_at DESC",
            "limit": 500,
        }))

        # Group by batch; each conflict carries its own status
        batches: dict[str, dict] = {}
        for r in rows:
            bid = to_string(r["batch_id"])
            if bid not in batches:
                batches[bid] = {
                    "batch_id": bid,
                    "batch_name": r.get("batch_title"),
                    "extracted_date": to_string(r.get("batch_created_at", ""))[:10],
                    "conflicts": [],
                }
            if r.get("conflict_id") is None:
                continue
            batches[bid]["conflicts"].append({
                "conflict_id": to_string(r["conflict_id"]),
                "conflict_type": conflict_type_mapping(r.get("conflict_type") or ""),
                "severity": conflict_severity_mapping(r.get("severity") or ""),
                "detected_at": to_string(r.get("detected_at", "")),
                "_status": r.get("conflict_status") or "pending",
            })

        pending_batches: list[dict] = []
        awaiting_summaries: list[dict] = []
        resolved_summaries: list[dict] = []

        def _strip(c: dict) -> dict:
            return {k: v for k, v in c.items() if k != "_status"}

        for b in batches.values():
            pending_in_batch = [c for c in b["conflicts"] if c["_status"] == "pending"]
            awaiting = [c for c in b["conflicts"] if c["_status"] == "awaiting"]
            resolved = [c for c in b["conflicts"] if c["_status"] == "resolved"]

            # Batch appears in pending only if it still has pending conflicts
            if pending_in_batch:
                pending_batches.append({
                    "batch_id": b["batch_id"],
                    "batch_name": b["batch_name"],
                    "extracted_date": b["extracted_date"],
                    "number_pending_conflict": len(pending_in_batch),
                    "conflicts": [_strip(c) for c in pending_in_batch],
                })
            awaiting_summaries.extend(_strip(c) for c in awaiting)
            resolved_summaries.extend(_strip(c) for c in resolved)

        return OK({"pending": pending_batches, "awaiting": awaiting_summaries, "resolved": resolved_summaries})
    except Exception as e:
        return ERR(500, str(e))


@router.get("/api/knowledge/conflicts/{conflict_id}", response_model=ResponseModel, tags=["Conflicts"])
async def get_conflict_detail(conflict_id: str, claims: JWTClaims = Depends(parse_jwt)):
    """
    JOIN KBConflictBatch → KBConflict (INNER) to return the full
    conflict detail including batch metadata.
    """
    try:
        rows = response_code_handler(await pg.read_join({
            "joins_table": ["KBConflictBatch", "KBConflict"],
            "join_on": [{
                "left_table": "KBConflictBatch", "left_column": "batch_id",
                "right_table": "KBConflict", "right_column": "batch_id",
                "join_type": "INNER",
            }],
            "selected_columns": [
                {"table_name": "KBConflictBatch", "column_name": "batch_id", "alias": "batch_id"},
                {"table_name": "KBConflictBatch", "column_name": "batch_title", "alias": "batch_title"},
                {"table_name": "KBConflict", "column_name": "conflict_id", "alias": "conflict_id"},
                {"table_name": "KBConflict", "column_name": "conflict_type", "alias": "conflict_type"},
                {"table_name": "KBConflict", "column_name": "severity", "alias": "severity"},
                {"table_name": "KBConflict", "column_name": "status", "alias": "status"},
                {"table_name": "KBConflict", "column_name": "detected_at", "alias": "detected_at"},
                {"table_name": "KBConflict", "column_name": "detailed_explanation", "alias": "detailed_explanation"},
                {"table_name": "KBConflict", "column_name": "existing_snapshot", "alias": "existing_snapshot"},
                {"table_name": "KBConflict", "column_name": "incoming_snapshot", "alias": "incoming_snapshot"},
                {"table_name": "KBConflict", "column_name": "resolution_instruction",
                 "alias": "resolution_instruction"},
                {"table_name": "KBConflict", "column_name": "resolved_at", "alias": "resolved_at"},
                {"table_name": "KBConflict", "column_name": "resolved_by", "alias": "resolved_by"},
            ],
            "filters": [
                {"table_name": "KBConflictBatch", "column_name": "tenant_id", "value": claims.tenant_id},
                {"table_name": "KBConflict", "column_name": "conflict_id", "value": uuid.UUID(conflict_id)},
            ],
            "limit": 1,
        }))

        if not rows:
            return ERR(404, f"Conflict {conflict_id} not found")

        def _snap(raw) -> dict:
            if raw is None:
                return {}
            if isinstance(raw, str):
                try:
                    val = json.loads(raw)
                    # doubly-encoded: stored as JSON string inside JSONB
                    if isinstance(val, str):
                        val = json.loads(val)
                    return val if isinstance(val, dict) else {}
                except Exception:
                    return {}
            return raw if isinstance(raw, dict) else {}

        r = rows[0]
        expl = r.get("detailed_explanation") or ""
        return OK({
            "conflict_id": to_string(r["conflict_id"]),
            "conflict_type": conflict_type_mapping(r.get("conflict_type") or ""),
            "where_happens": expl[:60],
            "severity": conflict_severity_mapping(r.get("severity") or ""),
            "detected_at": to_string(r.get("detected_at", "")),
            "status": r.get("status"),
            "batch_id": to_string(r["batch_id"]),
            "detailed_explanation": expl,
            "existing_snapshot": _snap(r.get("existing_snapshot")),
            "incoming_snapshot": _snap(r.get("incoming_snapshot")),
            "affected_location": "",
            "resolution_instruction": r.get("resolution_instruction") or "",
            "selected_resolution_method": None,
            "resolved_at": to_string(r.get("resolved_at")) if r.get("resolved_at") else None,
            "resolved_by": to_string(r.get("resolved_by")) if r.get("resolved_by") else None,
        })
    except Exception as e:
        return ERR(500, str(e))


@router.patch(
    "/api/knowledge/conflicts/{conflict_id}",
    response_model=ResponseModel, tags=["Conflicts"],
    dependencies=[Depends(require_permission("edit_conflict"))],
)
async def resolve_conflict(
        conflict_id: str,
        body: RequestResolveConflict,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        is_merge = body.selected_resolution_method.lower() == "merge"
        new_status = "awaiting" if is_merge else "resolved"
        response_code_handler(await pg.update("KBConflict", {
            "conflict_id": uuid.UUID(conflict_id),
            "status": new_status,
            "resolution_instruction": body.resolution_instruction,
            "resolved_by": claims.user_id if not is_merge else None,
        }))
        method_val = (
            body.selected_resolution_method.value
            if hasattr(body.selected_resolution_method, "value")
            else str(body.selected_resolution_method)
        )
        return OK({
            "conflict_id": conflict_id,
            "status": new_status,
            "selected_resolution_method": method_val,
            "resolution_instruction": body.resolution_instruction,
        })
    except Exception as e:
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/knowledge/policies/filtering", response_model=ResponseModel, tags=["Policies"])
async def get_filter_policies(claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read("KBFilterPolicy", {"tenant_id": claims.tenant_id, "limit": 100}))
        return OK([
            {
                "id": to_string(r["policy_id"]),
                "name": r.get("policy_name"),
                "type": extracting_policy_UI_to_type(r.get("configformat") or ""),
                "content": policy_rule_list_to_str(r.get("configformat") or "",(r.get("config") or {}).get("rules", [])),
                "added_by": to_string(r.get("created_by", "")) or "platform-admin",
                "added_when": str(r.get("created_at", ""))[:10],
                "active": bool(r.get("is_active", False)),
            }
            for r in rows
        ])
    except Exception as e:
        return ERR(500, str(e))


@router.post(
    "/api/knowledge/policies/filtering",
    response_model=ResponseModel, status_code=201, tags=["Policies"],
    dependencies=[Depends(require_permission("add_filtering_policy"))],
)
async def create_filter_policy(
        body: RequestCreateFilterPolicy,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        res = response_code_handler(await pg.create("KBFilterPolicy", {
            "tenant_id": claims.tenant_id,
            "policy_name": body.name,
            "configformat": extracting_policy_type_to_UI(body.type),
            "is_active": True,
            "created_by": claims.user_id,
            "config": {"rules": policy_rules_str_to_list(body.type, body.content), "threshold": 0.8},
        }))
        return CREATED({"policy_id": res.get("policy_id")})
    except Exception as e:
        return ERR(500, str(e))


@router.get(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel, tags=["Policies"],
)
async def get_filter_policy(policy_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read("KBFilterPolicy", {"tenant_id": claims.tenant_id, "limit": 100}))
        match = next((r for r in rows if str(r["policy_id"]) == policy_id), None)
        if match is None:
            return ERR(404, f"Policy {policy_id} not found")
        cfg = match.get("config") or {}
        fmt = match.get("configformat") or ""
        return OK({
            "id": to_string(match["policy_id"]),
            "name": match.get("policy_name"),
            "type": extracting_policy_UI_to_type(fmt),
            "content": policy_rule_list_to_str(fmt, cfg.get("rules", [])),
            "added_by": to_string(match.get("created_by", "")) or "platform-admin",
            "added_when": str(match.get("created_at", ""))[:10],
            "active": bool(match.get("is_active", False)),
        })
    except Exception as e:
        return ERR(500, str(e))


@router.put(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel, tags=["Policies"],
    dependencies=[Depends(require_permission("edit_filtering_policy"))],
)
async def update_filter_policy(
        policy_id: str,
        body: RequestUpdateFilterPolicy,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        update: dict[str, Any] = {"policy_id": uuid.UUID(policy_id)}
        data = body.model_dump(exclude_none=True)
        if "name" in data:
            update["policy_name"] = data["name"]
        if "type" in data:
            update["configformat"] = extracting_policy_type_to_UI(data["type"])
        if "active" in data:
            update["is_active"] = data["active"]
        if "content" in data:
            t = data.get("type", "natural_language")
            update["config"] = {"rules": policy_rules_str_to_list(t, data["content"]), "threshold": 0.8}
        response_code_handler(await pg.update("KBFilterPolicy", update))
        return OK({"policy_id": policy_id})
    except Exception as e:
        return ERR(500, str(e))


@router.delete(
    "/api/knowledge/policies/filtering/{policy_id}",
    response_model=ResponseModel, tags=["Policies"],
    dependencies=[Depends(require_permission("delete_filtering_policy"))],
)
async def delete_filter_policy(policy_id: str, claims: JWTClaims = Depends(parse_jwt)):
    try:
        response_code_handler(await pg.delete("KBFilterPolicy", {"policy_id": uuid.UUID(policy_id)}))
        return OK({"policy_id": policy_id})
    except Exception as e:
        return ERR(500, str(e))


@router.get("/api/knowledge/policies/extraction", response_model=ResponseModel, tags=["Policies"])
async def get_extraction_policy(claims: JWTClaims = Depends(parse_jwt)):
    try:
        rows = response_code_handler(await pg.read("KBExtractionPolicy", {"tenant_id": claims.tenant_id, "limit": 5}))
        custom = (rows[0].get("custom_override") or "") if rows else ""
        return OK({"base": "", "custom": custom})
    except Exception as e:
        return ERR(500, str(e))


@router.put(
    "/api/knowledge/policies/extraction/custom",
    response_model=ResponseModel, tags=["Policies"],
    dependencies=[Depends(require_permission("edit_extraction_policy"))],
)
async def update_extraction_policy_custom(
        body: RequestExtractionCustom,
        claims: JWTClaims = Depends(parse_jwt),
):
    try:
        rows = response_code_handler(await pg.read("KBExtractionPolicy", {"tenant_id": claims.tenant_id, "limit": 5}))
        if not rows:
            return ERR(404, "No extraction policy found for this tenant")
        response_code_handler(await pg.update("KBExtractionPolicy", {
            "policy_id": rows[0]["policy_id"],
            "custom_override": body.custom,
        }))
        return OK({"policy_id": to_string(rows[0]["policy_id"])})
    except Exception as e:
        return ERR(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# INGEST / WAREHOUSE CONNECT (not yet implemented)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/knowledge/data_upload", response_model=ResponseModel, tags=["Data"])
async def upload_data(body: RequestDataUpload, claims: JWTClaims = Depends(parse_jwt)):
    return ERR(501, "Not implemented")


@router.post("/api/knowledge/confirm/{upload_id}", response_model=ResponseModel, tags=["Data"])
async def confirm_upload(upload_id: uuid.UUID, body: RequestConfirmDataUpload, claims: JWTClaims = Depends(parse_jwt)):
    return ERR(501, "Not implemented")


@router.post("/api/knowledge/connect", response_model=ResponseModel, tags=["Warehouse"])
async def connect_warehouse(body: RequestConnectWarehouse, claims: JWTClaims = Depends(parse_jwt)):
    return ERR(501, "Not implemented")


@router.post("/api/knowledge/select_table/{connection_id}", response_model=ResponseModel, tags=["Warehouse"])
async def select_tables(connection_id: uuid.UUID, body: RequestSelectTable, claims: JWTClaims = Depends(parse_jwt)):
    return ERR(501, "Not implemented")
