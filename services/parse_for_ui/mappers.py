"""
All DB-row → UI-JSON transformations for the AeroFlow KB API.

Router responsibility: fetch data from DB services, pass raw rows here,
return the result. No shape-building lives in the router.
"""

import json
from typing import Any

from .schema.response import (
    FleetStats, FleetContent,
    DocResponse, DocumentMetadata,
    ChunkResponse, ChunkVersion,
    TableResponse, TableColumn,
    WarehouseConfigResponse,
    QdrantCollectionResponse, QdrantPointResponse,
    Neo4jGraphResponse, Neo4jNode, Neo4jEdge, Neo4jSchemaResponse,
    ConflictBucketsResponse, ConflictSummary, PendingConflictBatch, ConflictDetailResponse,
    FilterPolicyResponse, ExtractionPolicyResponse,
)


# ── Shared utilities ──────────────────────────────────────────────────────────

def to_string(v) -> str:
    return str(v) if v is not None else ""


def parse_jsonb(v) -> dict:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return v or {}


def handle_response(res) -> Any:
    if res.code >= 400:
        raise ValueError(res.error or f"DB error {res.code}")
    return res.data if res.data is not None else []


# ── Lookup tables ─────────────────────────────────────────────────────────────

_CONFLICT_TYPE_DISPLAY = {
    "content_contradiction": "Content Contradiction",
    "content_conflict":      "Content Conflict",
    "content_duplicate":     "Content Duplicate",
    "content_update":        "Content Update",
    "table_schema":          "Table Schema",
}
_SEVERITY_DISPLAY = {"high": "High", "medium": "Medium", "low": "Low"}

_POLICY_FMT_TO_TYPE = {
    "Natural Language":               "natural_language",
    "Exact Match For Word or Phrase": "exact_word",
}
_POLICY_TYPE_TO_FMT = {v: k for k, v in _POLICY_FMT_TO_TYPE.items()}


# ── Fleet ─────────────────────────────────────────────────────────────────────

def map_fleet_stats(gold_docs: list, qdrant_rows: list, neo_conns: list, batches: list) -> FleetStats:
    counts: dict[str, int] = {}
    for d in gold_docs:
        st = d.get("source_type", "doc")
        counts[st] = counts.get(st, 0) + 1

    total_nodes = sum(r.get("total_node", 0) for r in neo_conns)
    total_edges = sum(r.get("total_edge", 0) for r in neo_conns)
    unresolved = sum(1 for b in batches if b.get("status") in ("pending", "awaiting"))

    return FleetStats(
        content=FleetContent(
            documents=counts.get("doc", 0),
            web=counts.get("web", 0),
            media=counts.get("image", 0) + counts.get("video", 0),
            warehouses=counts.get("warehouse", 0),
        ),
        qdrant_collections=len(qdrant_rows),
        neo4j_nodes=total_nodes,
        neo4j_relationships=total_edges,
        unresolved_conflict_batches=unresolved,
    )


# ── Documents ─────────────────────────────────────────────────────────────────

def map_doc(row: dict) -> DocResponse:
    meta = parse_jsonb(row.get("metadata"))

    st  = row.get("source_type", "doc")
    ext = (row.get("extension") or "").upper()
    doc_type = (
        f"Doc/{ext}"              if st == "doc"       and ext else
        "Web"                     if st == "web"               else
        f"Image/{ext}"            if st == "image"     and ext else
        "Image"                   if st == "image"             else
        f"Video/{ext}"            if st == "video"     and ext else
        "Video"                   if st == "video"             else
        f"Warehouse/{meta.get('warehouse_type', '')}" if st == "warehouse" else
        st
    )
    tier = (row.get("current_tier") or "bronze").lower()

    return DocResponse(
        id=to_string(row["data_id"]),
        name=row.get("name", ""),
        layer=tier.upper(),
        status={"gold": "PUBLISHED", "silver": "EMBEDDING"}.get(tier, "RAW"),
        version="v1.0",
        author=meta.get("author") or to_string(row.get("added_by")),
        last_updated=to_string(row.get("added_on", "")),
        metadata=DocumentMetadata(
            type=doc_type,
            language=row.get("language"),
            access_role=meta.get("access_role"),
            url=meta.get("url"),
            author=meta.get("author"),
            published_date=meta.get("published_date"),
            warehouse_type=meta.get("warehouse_type"),
            width=meta.get("width"),
            height=meta.get("height"),
            color_space=meta.get("color_space"),
            file_size=meta.get("file_size"),
            total_frame=meta.get("total_frame"),
        ),
    )


# ── Chunks ────────────────────────────────────────────────────────────────────

def map_chunks(rows: list) -> list[ChunkResponse]:
    blocks: dict[str, dict] = {}
    for r in rows:
        bid = to_string(r["block_id"])
        if bid not in blocks:
            blocks[bid] = {"id": bid, "title": f"Chunk {r['block_index'] + 1}", "text": "", "versions": []}
        if r.get("version_id") is None:
            continue
        payload = parse_jsonb(r.get("payload"))
        blocks[bid]["versions"].append(ChunkVersion(
            version_number=to_string(r["version_number"]),
            create_at=to_string(r.get("created_at", "")),
            status="active" if r.get("is_active") else "inactive",
            embedding_models=to_string(r.get("embedding_model_id", "")),
            entities=payload.get("entities", []),
            intent=", ".join(payload.get("intents", [])),
            text=r.get("content") or "",
        ))
        if r.get("is_active"):
            blocks[bid]["text"] = r.get("content") or ""

    return [
        ChunkResponse(id=b["id"], title=b["title"], text=b["text"], versions=b["versions"])
        for b in blocks.values()
    ]


# ── Tables ────────────────────────────────────────────────────────────────────

def map_table(r: dict) -> TableResponse:
    data = parse_jsonb(r.get("data"))
    raw_cols = data.get("columns", [])
    raw_rows = data.get("rows", [])
    col_dicts = (
        [{"name": c, "type": "TEXT", "nullable": True} for c in raw_cols]
        if raw_cols and isinstance(raw_cols[0], str)
        else raw_cols
    )
    col_names = [c if isinstance(c, str) else c.get("name", "") for c in raw_cols]
    rows = (
        [dict(zip(col_names, row)) for row in raw_rows]
        if raw_rows and isinstance(raw_rows[0], list)
        else raw_rows
    )
    return TableResponse(
        id=to_string(r["id"]),
        name=r.get("table_name") or "",
        description=r.get("description") or "",
        columns=[TableColumn(**c) for c in col_dicts],
        rows=rows,
    )


def map_tables(rows: list) -> list[TableResponse]:
    return [map_table(r) for r in rows]


# ── Warehouse configs ─────────────────────────────────────────────────────────

def map_warehouse_config(r: dict) -> WarehouseConfigResponse:
    cfg = r.get("config") or {}
    return WarehouseConfigResponse(
        id=to_string(r["config_id"]),
        version=r.get("version_number"),
        active=bool(r.get("is_active", False)),
        host=cfg.get("host"),
        database=cfg.get("database"),
        selected_tables=cfg.get("selected_tables", []),
        sync_schedule=cfg.get("sync_schedule"),
        schema_filter=cfg.get("schema_filter", []),
        created_at=to_string(r.get("created_at", "")),
    )


def map_warehouse_configs(rows: list) -> list[WarehouseConfigResponse]:
    return [map_warehouse_config(r) for r in rows]


# ── Qdrant ────────────────────────────────────────────────────────────────────

def map_qdrant_collection(r: dict) -> QdrantCollectionResponse:
    return QdrantCollectionResponse(
        id=to_string(r["id"]),
        name=r.get("name"),
        active=bool(r.get("active", False)),
        points=r.get("points", 0),
        dimensions=r.get("dimensions") or 0,
        distance=r.get("distance", "cosine"),
        indexed=100 if r.get("active") else 0,
        embedding_model=r.get("embedding_model"),
    )


def map_qdrant_collections(rows: list) -> list[QdrantCollectionResponse]:
    return [map_qdrant_collection(r) for r in rows]


def map_qdrant_point(point) -> QdrantPointResponse:
    payload = point.payload or {}
    return QdrantPointResponse(
        point_id=to_string(point.id),
        score=1.0,
        summary=payload.get("summary", ""),
        entities=payload.get("entities", []),
        intent=payload.get("intents", []),
    )


# ── Neo4j ─────────────────────────────────────────────────────────────────────

def map_neo4j_graph(node_rows: list, edge_rows: list) -> Neo4jGraphResponse:
    node_id_set = {to_string(n["node_id"]) for n in node_rows}
    return Neo4jGraphResponse(
        nodes=[
            Neo4jNode(
                id=to_string(n["node_id"]),
                name=n.get("node_name"),
                description=n.get("node_description"),
            )
            for n in node_rows
        ],
        edges=[
            Neo4jEdge.model_validate({
                "from":        to_string(e["from_id"]),
                "to":          to_string(e["to_id"]),
                "description": e.get("description"),
                "score":       e.get("score"),
            })
            for e in edge_rows
            if to_string(e.get("to_id")) in node_id_set
        ],
    )


def build_neo4j_schema(node_rows: list, edge_rows: list) -> Neo4jSchemaResponse:
    id_to_name = {str(r["node_id"]): r.get("node_name", "") for r in node_rows}
    entities   = [r.get("node_name", "") for r in node_rows if r.get("node_name")]

    connections: dict[str, list[str]] = {}
    for e in edge_rows:
        from_name = id_to_name.get(str(e.get("from_id", "")), "")
        to_name   = id_to_name.get(str(e.get("to_id",   "")), "")
        if not from_name or not to_name:
            continue
        targets = connections.setdefault(from_name, [])
        if to_name not in targets:
            targets.append(to_name)

    return Neo4jSchemaResponse(entities=entities, connections=connections)


# ── Conflicts ─────────────────────────────────────────────────────────────────

def map_conflict_type(v: str) -> str:
    return _CONFLICT_TYPE_DISPLAY.get(v, v)


def map_severity(v: str) -> str:
    return _SEVERITY_DISPLAY.get(v, v)


def map_conflict_batches(rows: list) -> ConflictBucketsResponse:
    batches: dict[str, dict] = {}
    for r in rows:
        bid = to_string(r["batch_id"])
        if bid not in batches:
            batches[bid] = {
                "batch_id":       bid,
                "batch_name":     r.get("batch_title"),
                "extracted_date": to_string(r.get("batch_created_at", ""))[:10],
                "conflicts":      [],
            }
        if r.get("conflict_id") is None:
            continue
        batches[bid]["conflicts"].append({
            "conflict_id":   to_string(r["conflict_id"]),
            "conflict_type": map_conflict_type(r.get("conflict_type") or ""),
            "severity":      map_severity(r.get("severity") or ""),
            "detected_at":   to_string(r.get("detected_at", "")),
            "_status":       r.get("conflict_status") or "pending",
        })

    pending_batches: list[PendingConflictBatch] = []
    awaiting: list[ConflictSummary] = []
    resolved: list[ConflictSummary] = []

    for b in batches.values():
        pending_in_batch = [c for c in b["conflicts"] if c["_status"] == "pending"]
        aw = [c for c in b["conflicts"] if c["_status"] == "awaiting"]
        re = [c for c in b["conflicts"] if c["_status"] == "resolved"]

        if pending_in_batch:
            pending_batches.append(PendingConflictBatch(
                batch_id=b["batch_id"],
                batch_name=b["batch_name"],
                extracted_date=b["extracted_date"],
                number_pending_conflict=len(pending_in_batch),
                conflicts=[ConflictSummary(**{k: v for k, v in c.items() if k != "_status"}) for c in pending_in_batch],
            ))
        awaiting.extend(ConflictSummary(**{k: v for k, v in c.items() if k != "_status"}) for c in aw)
        resolved.extend(ConflictSummary(**{k: v for k, v in c.items() if k != "_status"}) for c in re)

    return ConflictBucketsResponse(pending=pending_batches, awaiting=awaiting, resolved=resolved)


def _parse_snapshot(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            val = json.loads(raw)
            if isinstance(val, str):
                val = json.loads(val)
            return val if isinstance(val, dict) else {}
        except Exception:
            return {}
    return raw if isinstance(raw, dict) else {}


def map_conflict_detail(r: dict) -> ConflictDetailResponse:
    expl = r.get("detailed_explanation") or ""
    return ConflictDetailResponse(
        conflict_id=to_string(r["conflict_id"]),
        conflict_type=map_conflict_type(r.get("conflict_type") or ""),
        where_happens=expl[:60],
        severity=map_severity(r.get("severity") or ""),
        detected_at=to_string(r.get("detected_at", "")),
        status=r.get("status"),
        batch_id=to_string(r["batch_id"]),
        detailed_explanation=expl,
        existing_snapshot=_parse_snapshot(r.get("existing_snapshot")),
        incoming_snapshot=_parse_snapshot(r.get("incoming_snapshot")),
        affected_location="",
        resolution_instruction=r.get("resolution_instruction") or "",
        selected_resolution_method=r.get("selected_resolution_method"),
        resolved_at=to_string(r.get("resolved_at")) if r.get("resolved_at") else None,
        resolved_by=to_string(r.get("resolved_by")) if r.get("resolved_by") else None,
    )


# ── Policies ──────────────────────────────────────────────────────────────────

def policy_fmt_to_type(fmt: str) -> str:
    return _POLICY_FMT_TO_TYPE.get(fmt, "natural_language")


def policy_type_to_fmt(t: str) -> str:
    return _POLICY_TYPE_TO_FMT.get(t, "Natural Language")


def policy_rules_to_str(fmt: str, rules: list) -> str:
    if policy_fmt_to_type(fmt) == "exact_word":
        return json.dumps(rules)
    return " ".join(str(r) for r in rules) if rules else ""


def policy_rules_to_list(policy_type: str, content: str) -> list:
    if policy_type == "exact_word":
        try:
            return json.loads(content)
        except Exception:
            return [content]
    return [content]


def map_filter_policy(r: dict) -> FilterPolicyResponse:
    fmt = r.get("configformat") or ""
    cfg = r.get("config") or {}
    return FilterPolicyResponse(
        id=to_string(r["policy_id"]),
        name=r.get("policy_name"),
        type=policy_fmt_to_type(fmt),
        content=policy_rules_to_str(fmt, cfg.get("rules", [])),
        added_by=to_string(r.get("created_by", "")) or "platform-admin",
        added_when=str(r.get("created_at", ""))[:10],
        active=bool(r.get("is_active", False)),
    )


def map_filter_policies(rows: list) -> list[FilterPolicyResponse]:
    return [map_filter_policy(r) for r in rows]


def map_extraction_policy(rows: list) -> ExtractionPolicyResponse:
    custom = (rows[0].get("custom_override") or "") if rows else ""
    return ExtractionPolicyResponse(base="", custom=custom)
