from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


# ── Fleet ─────────────────────────────────────────────────────────────────────

class FleetContent(BaseModel):
    documents: int
    web: int
    media: int
    warehouses: int


class FleetStats(BaseModel):
    content: FleetContent
    qdrant_collections: int
    neo4j_nodes: int
    neo4j_relationships: int
    unresolved_conflict_batches: int


# ── Document ──────────────────────────────────────────────────────────────────

class DocumentMetadata(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    type: str | None = None
    language: str | None = None
    access_role: str | None = None
    url: str | None = None
    author: str | None = None
    published_date: str | None = None
    warehouse_type: str | None = None
    width: int | None = None
    height: int | None = None
    color_space: str | None = None
    file_size: int | None = None
    total_frame: int | None = None


class DocResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    name: str
    layer: str
    status: str
    version: str
    author: str
    last_updated: str
    metadata: DocumentMetadata


# ── Chunks ────────────────────────────────────────────────────────────────────

class ChunkVersion(BaseModel):
    version_number: str
    create_at: str
    status: str
    embedding_models: str
    entities: list[Any]
    intent: str
    text: str


class ChunkResponse(BaseModel):
    id: str
    title: str
    text: str
    versions: list[ChunkVersion]


# ── Tables ────────────────────────────────────────────────────────────────────

class TableColumn(BaseModel):
    name: str
    type: str
    nullable: bool


class TableResponse(BaseModel):
    id: str
    name: str
    description: str
    columns: list[TableColumn]
    rows: list[dict[str, Any]]


# ── Warehouse configs ─────────────────────────────────────────────────────────

class WarehouseConfigResponse(BaseModel):
    id: str
    version: Any | None
    active: bool
    host: str | None
    database: str | None
    selected_tables: list[str]
    sync_schedule: str | None
    schema_filter: list[str]
    created_at: str


# ── Qdrant ────────────────────────────────────────────────────────────────────

class QdrantCollectionResponse(BaseModel):
    id: str
    name: str | None
    active: bool
    points: int
    dimensions: int
    distance: str
    indexed: int
    embedding_model: str | None


class QdrantPointResponse(BaseModel):
    point_id: str
    score: float
    summary: str
    entities: list[Any]
    intent: list[Any]


# ── Neo4j ─────────────────────────────────────────────────────────────────────

class Neo4jNode(BaseModel):
    id: str
    name: str | None
    description: str | None


class Neo4jEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str = Field(alias="from")
    to: str
    description: str | None
    score: float | None


class Neo4jGraphResponse(BaseModel):
    nodes: list[Neo4jNode]
    edges: list[Neo4jEdge]


class Neo4jSchemaResponse(BaseModel):
    entities: list[str]
    connections: dict[str, list[str]]


# ── Conflicts ─────────────────────────────────────────────────────────────────

class ConflictSummary(BaseModel):
    conflict_id: str
    conflict_type: str
    severity: str
    detected_at: str


class PendingConflictBatch(BaseModel):
    batch_id: str
    batch_name: str | None
    extracted_date: str
    number_pending_conflict: int
    conflicts: list[ConflictSummary]


class ConflictBucketsResponse(BaseModel):
    pending: list[PendingConflictBatch]
    awaiting: list[ConflictSummary]
    resolved: list[ConflictSummary]


class ConflictDetailResponse(BaseModel):
    conflict_id: str
    conflict_type: str
    where_happens: str
    severity: str
    detected_at: str
    status: str | None
    batch_id: str
    detailed_explanation: str
    existing_snapshot: dict[str, Any]
    incoming_snapshot: dict[str, Any]
    affected_location: str
    resolution_instruction: str
    selected_resolution_method: str | None
    resolved_at: str | None
    resolved_by: str | None


# ── Policies ──────────────────────────────────────────────────────────────────

class FilterPolicyResponse(BaseModel):
    id: str
    name: str | None
    type: str
    content: str
    added_by: str
    added_when: str
    active: bool


class ExtractionPolicyResponse(BaseModel):
    base: str
    custom: str


# ── Mutation / action responses ───────────────────────────────────────────────

class StatusResponse(BaseModel):
    status: str

class ConfigActivateResponse(BaseModel):
    status: str
    config_id: str

class VersionCreatedResponse(BaseModel):
    version_id: str | None = None
    version_number: int

class ConfigCreatedResponse(BaseModel):
    config_id: str | None = None
    version_number: int

class PolicyCreatedResponse(BaseModel):
    policy_id: str | None = None

class ConflictResolvedResponse(BaseModel):
    conflict_id: str
    status: str

class ToggleCollectionResponse(BaseModel):
    collection_id: str
    active: bool

class RowUpdateResponse(BaseModel):
    status: str
    row: dict[str, Any]
