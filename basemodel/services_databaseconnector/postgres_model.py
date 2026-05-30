import datetime
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any, Annotated, Literal, Optional, Type, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer,
    String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

_ROLES = frozenset({"create", "read", "update", "delete", "orm"})
_partial: dict[str, dict] = {}

Method = Literal["create", "read", "update", "delete", "orm"]


@dataclass
class OperationSchema:
    create: Type[BaseModel]
    read: Type[BaseModel]
    update: Type[BaseModel]
    delete: Type[BaseModel]
    orm: Any


REGISTRY: dict[str, OperationSchema] = {}
MODEL_TO_TABLE: dict[type, str] = {}


def register(table: str, method: Method):
    def decorator(cls: type) -> type:
        if table not in _partial:
            _partial[table] = {}
        _partial[table][method] = cls
        MODEL_TO_TABLE[cls] = table
        if _ROLES.issubset(_partial[table]):
            REGISTRY[table] = OperationSchema(**{r: _partial[table][r] for r in _ROLES})
        return cls
    return decorator


"""
Enum
"""


class Language(Enum):
    EN = "english"
    VN = "vietnamese"


class SourceType(str, Enum):
    DOC = "doc"
    WEB = "web"
    IMAGE = "image"
    VIDEO = "video"
    WAREHOUSE = "warehouse"


class Tier(Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"


class ActiveStatus(Enum):
    active = "active"
    inactive = "inactive"


class PolicyFilteringType(Enum):
    NATURAL_LANG = "Natural Language"
    EXACT_MATCH = "Exact Match For Word or Phrase"


PolicyFormat = PolicyFilteringType


class PolicyExtractionType(Enum):
    ENTITY_NODE = "Entity"
    RELATIONSHIP_EDGE = "Relationship Edge"


PolicyType = PolicyExtractionType


class ConflictType(Enum):
    CONTENT_CONTRADICTION = "content_contradiction"
    CONTENT_CONFLICT = "content_conflict"
    CONTENT_DUPLICATE = "content_duplicate"
    CONTENT_UPDATE = "content_update"
    TABLE_SCHEMA = "table_schema"


class ConflictResolution(Enum):
    KEEP_EXISTING = "keep_existing"
    KEEP_INCOMING = "keep_incoming"
    MERGE = "merge"
    DELETE = "delete"


class ConflictSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ConflictStatus(Enum):
    PENDING = "pending"
    AWAITING = "awaiting"
    RESOLVED = "resolved"


class TaskType(Enum):
    EMBEDDING = "embedding"
    VLM = "Vision Language Model"


class SimilarityMetric(Enum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT = "dot"


class HttpMethod(Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


class APIType(Enum):
    NEO4J = "NEO4J"
    QDRANT = "QDRANT"
    RETRIEVE = "RETRIEVE"


"""
Base Struct
"""


class Document(BaseModel):
    source_type: Literal[SourceType.DOC]
    doc_type: str
    author: str | None = None
    published_date: datetime.datetime | None = None
    file_size: int | None = None


class Image(BaseModel):
    source_type: Literal[SourceType.IMAGE]
    image_type: str
    height: int
    width: int
    color_space: str | None = None
    file_size: int | None = None


class Video(BaseModel):
    source_type: Literal[SourceType.VIDEO]
    video_type: str
    height: int
    width: int
    codec: str | None = None
    total_frame: int
    file_size: int | None = None


class Web(BaseModel):
    source_type: Literal[SourceType.WEB]
    url: str
    web_name: str


class Warehouse(BaseModel):
    source_type: Literal[SourceType.WAREHOUSE]
    warehouse_type: str | None = None


MetadataType = Annotated[
    Union[Document, Image, Video, Web, Warehouse],
    Field(discriminator="source_type"),
]


class PolicyConfig(BaseModel):
    rules: Optional[list[str]]
    threshold: Optional[float] = None
    extra: Optional[dict[str, Any]] = None


class WarehouseConfigPayload(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    selected_tables: Optional[list[str]] = None
    sync_schedule: Optional[str] = None
    schema_filter: Optional[list[str]] = None
    extra: Optional[dict[str, Any]] = None


class ModelConfig(BaseModel):
    vector_size: Optional[int] = None
    max_tokens: Optional[int] = None
    extra: Optional[dict[str, Any]] = None


"""
Request Model
"""

# ── Create ────────────────────────────────────────────────────────────────────


@register("KBModel", "create")
class KBModelCreate(BaseModel):
    model_name: str
    task_type: TaskType
    model_config = ConfigDict(use_enum_values=True)


@register("KBModelVersion", "create")
class KBModelVersionCreate(BaseModel):
    model_id: str
    version_number: int
    added_by: Optional[str] = None
    config: Optional[ModelConfig] = None
    is_active: bool = False


@register("KBData", "create")
class KBDataCreate(BaseModel):
    tenant_id: str
    role_id: str
    name: str
    extension: str
    language: Language
    source_type: SourceType
    added_by: str
    abstract: str
    metadata: MetadataType
    current_tier: Tier = Tier.BRONZE
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBLifecycleHistory", "create")
class KBLifecycleHistoryCreate(BaseModel):
    data_id: str
    to_tier: Tier
    from_tier: Optional[Tier] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBFilterPolicy", "create")
class KBFilterPolicyCreate(BaseModel):
    tenant_id: str
    policy_name: str
    configformat: PolicyFormat
    config: Optional[PolicyConfig] = None
    is_active: bool = False
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBExtractionPolicy", "create")
class KBExtractionPolicyCreate(BaseModel):
    tenant_id: str
    policy_name: str
    policy_type: PolicyType
    custom_override: Optional[str] = None
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflictBatch", "create")
class KBConflictBatchCreate(BaseModel):
    batch_title: str
    tenant_id: Optional[str] = None
    status: ConflictStatus = ConflictStatus.PENDING
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflict", "create")
class KBConflictCreate(BaseModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    tenant_id: Optional[str] = None
    batch_id: Optional[str] = None
    status: ConflictStatus = ConflictStatus.PENDING
    detailed_explanation: Optional[str] = None
    existing_snapshot: Optional[dict[str, Any]] = None
    incoming_snapshot: Optional[dict[str, Any]] = None
    resolution_instruction: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBWarehouse", "create")
class KBWarehouseCreate(BaseModel):
    service: str
    description: Optional[str] = None


@register("KBWarehouse_Config", "create")
class KBWarehouseConfigCreate(BaseModel):
    warehouse_id: str
    version_number: int
    is_active: bool = False
    config: Optional[WarehouseConfigPayload] = None
    created_by: Optional[str] = None


@register("KBTable", "create")
class KBTableCreate(BaseModel):
    owner_id: str
    table_name: str
    description: Optional[str] = None
    table_schema: Optional[dict[str, Any]] = None
    created_by: Optional[str] = None


@register("KBTextBlock", "create")
class KBTextBlockCreate(BaseModel):
    owner_id: str
    block_index: int


@register("KBTextBlockVersion", "create")
class KBTextBlockVersionCreate(BaseModel):
    block_id: str
    version_number: int
    content: Optional[str] = None
    created_by: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


@register("KBTextTable", "create")
class KBTextTableCreate(BaseModel):
    version_id: str
    table_name: str
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


@register("KBQdrantConnection", "create")
class KBQdrantConnectionCreate(BaseModel):
    tenant_id: str
    is_active: bool = False
    total_collection: int = 0


@register("KBQdrantCollection", "create")
class KBQdrantCollectionCreate(BaseModel):
    connection_id: str
    collection_name: str
    is_active: bool = False
    similarity_metric: SimilarityMetric = SimilarityMetric.COSINE
    points_count: int = 0
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBNeo4jConnection", "create")
class KBNeo4jConnectionCreate(BaseModel):
    tenant_id: str
    is_connected: bool = False
    total_node: int = 0
    total_edge: int = 0
    embedding_model_id: Optional[str] = None


@register("KBNeo4jNode", "create")
class KBNeo4jNodeCreate(BaseModel):
    connection_id: str
    node_name: str
    node_description: Optional[str] = None


@register("KBNeo4jRelationship", "create")
class KBNeo4jRelationshipCreate(BaseModel):
    from_node: str
    to_node: str
    score: Optional[float] = None
    description: Optional[str] = None


@register("KBEntityLookup", "create")
class KBEntityLookupCreate(BaseModel):
    alias_name: str
    canonical_name: str


@register("KBPublishAPI", "create")
class KBPublishAPICreate(BaseModel):
    tenant_id: str
    name: str
    type: APIType
    endpoint_url: str
    http_method: HttpMethod
    is_published: bool = False
    model_config = ConfigDict(use_enum_values=True)


# ── Read ──────────────────────────────────────────────────────────────────────


@register("KBModel", "read")
class KBModelRead(BaseModel):
    tenant_id: str
    task_type: Optional[TaskType] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBModelVersion", "read")
class KBModelVersionRead(BaseModel):
    tenant_id: str
    model_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBData", "read")
class KBDataRead(BaseModel):
    tenant_id: str
    data_id: Optional[str] = None
    source_type: Optional[SourceType] = None
    role_id: Optional[str] = None
    current_tier: Optional[Tier] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBLifecycleHistory", "read")
class KBLifecycleHistoryRead(BaseModel):
    tenant_id: str
    data_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBFilterPolicy", "read")
class KBFilterPolicyRead(BaseModel):
    tenant_id: str
    language: Optional[Language] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBExtractionPolicy", "read")
class KBExtractionPolicyRead(BaseModel):
    tenant_id: str
    language: Optional[Language] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflictBatch", "read")
class KBConflictBatchRead(BaseModel):
    tenant_id: str
    status: Optional[ConflictStatus] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflict", "read")
class KBConflictRead(BaseModel):
    tenant_id: str
    batch_id: Optional[str] = None
    status: Optional[ConflictStatus] = None
    severity: Optional[ConflictSeverity] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBWarehouse", "read")
class KBWarehouseRead(BaseModel):
    tenant_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBWarehouse_Config", "read")
class KBWarehouseConfigRead(BaseModel):
    tenant_id: str
    warehouse_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBTable", "read")
class KBTableRead(BaseModel):
    tenant_id: str
    owner_id: Optional[str] = None
    table_name: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBTextBlock", "read")
class KBTextBlockRead(BaseModel):
    tenant_id: str
    owner_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBTextBlockVersion", "read")
class KBTextBlockVersionRead(BaseModel):
    tenant_id: str
    block_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBTextTable", "read")
class KBTextTableRead(BaseModel):
    tenant_id: str
    version_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBQdrantConnection", "read")
class KBQdrantConnectionRead(BaseModel):
    tenant_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBQdrantCollection", "read")
class KBQdrantCollectionRead(BaseModel):
    tenant_id: str
    connection_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBNeo4jConnection", "read")
class KBNeo4jConnectionRead(BaseModel):
    tenant_id: str
    is_connected: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBNeo4jNode", "read")
class KBNeo4jNodeRead(BaseModel):
    tenant_id: str
    connection_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBNeo4jRelationship", "read")
class KBNeo4jRelationshipRead(BaseModel):
    tenant_id: str
    from_node: Optional[str] = None
    to_node: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBEntityLookup", "read")
class KBEntityLookupRead(BaseModel):
    tenant_id: str
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("KBPublishAPI", "read")
class KBPublishAPIRead(BaseModel):
    tenant_id: str
    is_published: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


# ── Update ────────────────────────────────────────────────────────────────────


@register("KBModel", "update")
class KBModelUpdate(BaseModel):
    model_id: str
    model_name: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBModelVersion", "update")
class KBModelVersionUpdate(BaseModel):
    version_id: int
    config: Optional[ModelConfig] = None
    is_active: Optional[bool] = None


@register("KBData", "update")
class KBDataUpdate(BaseModel):
    data_id: str
    name: Optional[str] = None
    extension: Optional[str] = None
    language: Optional[Language] = None
    current_tier: Optional[Tier] = None
    abstract: Optional[str] = None
    metadata: Optional[MetadataType] = None
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBLifecycleHistory", "update")
class KBLifecycleHistoryUpdate(BaseModel):
    history_id: str
    notes: Optional[str] = None


@register("KBFilterPolicy", "update")
class KBFilterPolicyUpdate(BaseModel):
    policy_id: str
    policy_name: Optional[str] = None
    configformat: Optional[PolicyFormat] = None
    config: Optional[PolicyConfig] = None
    is_active: Optional[bool] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBExtractionPolicy", "update")
class KBExtractionPolicyUpdate(BaseModel):
    policy_id: str
    policy_name: Optional[str] = None
    policy_type: Optional[PolicyType] = None
    custom_override: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflictBatch", "update")
class KBConflictBatchUpdate(BaseModel):
    batch_id: str
    batch_title: Optional[str] = None
    status: Optional[ConflictStatus] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBConflict", "update")
class KBConflictUpdate(BaseModel):
    conflict_id: str
    batch_id: Optional[str] = None
    status: Optional[ConflictStatus] = None
    resolution_instruction: Optional[str] = None
    resolved_by: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBWarehouse", "update")
class KBWarehouseUpdate(BaseModel):
    warehouse_id: str
    service: Optional[str] = None
    description: Optional[str] = None


@register("KBWarehouse_Config", "update")
class KBWarehouseConfigUpdate(BaseModel):
    config_id: str
    config: Optional[WarehouseConfigPayload] = None
    is_active: Optional[bool] = None


@register("KBTable", "update")
class KBTableUpdate(BaseModel):
    table_id: str
    table_name: Optional[str] = None
    description: Optional[str] = None
    table_schema: Optional[dict[str, Any]] = None


@register("KBTextBlock", "update")
class KBTextBlockUpdate(BaseModel):
    block_id: str
    block_index: Optional[int] = None


@register("KBTextBlockVersion", "update")
class KBTextBlockVersionUpdate(BaseModel):
    version_id: str
    is_active: Optional[bool] = None
    content: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


@register("KBTextTable", "update")
class KBTextTableUpdate(BaseModel):
    version_id: str
    table_name: Optional[str] = None
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


@register("KBQdrantConnection", "update")
class KBQdrantConnectionUpdate(BaseModel):
    connection_id: str
    is_active: Optional[bool] = None
    total_collection: Optional[int] = None


@register("KBQdrantCollection", "update")
class KBQdrantCollectionUpdate(BaseModel):
    collection_id: str
    is_active: Optional[bool] = None
    similarity_metric: Optional[SimilarityMetric] = None
    points_count: Optional[int] = None
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("KBNeo4jConnection", "update")
class KBNeo4jConnectionUpdate(BaseModel):
    connection_id: str
    is_connected: Optional[bool] = None
    total_node: Optional[int] = None
    total_edge: Optional[int] = None
    embedding_model_id: Optional[str] = None


@register("KBNeo4jNode", "update")
class KBNeo4jNodeUpdate(BaseModel):
    node_id: str
    node_name: Optional[str] = None
    node_description: Optional[str] = None


@register("KBNeo4jRelationship", "update")
class KBNeo4jRelationshipUpdate(BaseModel):
    from_node: str
    to_node: str
    score: Optional[float] = None
    description: Optional[str] = None


@register("KBEntityLookup", "update")
class KBEntityLookupUpdate(BaseModel):
    lookup_id: str
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None


@register("KBPublishAPI", "update")
class KBPublishAPIUpdate(BaseModel):
    id: str
    name: Optional[str] = None
    type: Optional[APIType] = None
    endpoint_url: Optional[str] = None
    http_method: Optional[HttpMethod] = None
    is_published: Optional[bool] = None
    model_config = ConfigDict(use_enum_values=True)


# ── Delete ────────────────────────────────────────────────────────────────────


@register("KBModel", "delete")
class KBModelDelete(BaseModel):
    tenant_id: str
    model_id: str


@register("KBModelVersion", "delete")
class KBModelVersionDelete(BaseModel):
    tenant_id: str
    version_id: int


@register("KBData", "delete")
class KBDataDelete(BaseModel):
    tenant_id: str
    data_id: str


@register("KBLifecycleHistory", "delete")
class KBLifecycleHistoryDelete(BaseModel):
    tenant_id: str
    history_id: str


@register("KBFilterPolicy", "delete")
class KBFilterPolicyDelete(BaseModel):
    tenant_id: str
    policy_id: str


@register("KBExtractionPolicy", "delete")
class KBExtractionPolicyDelete(BaseModel):
    tenant_id: str
    policy_id: str


@register("KBConflictBatch", "delete")
class KBConflictBatchDelete(BaseModel):
    tenant_id: str
    batch_id: str


@register("KBConflict", "delete")
class KBConflictDelete(BaseModel):
    tenant_id: str
    conflict_id: str


@register("KBWarehouse", "delete")
class KBWarehouseDelete(BaseModel):
    tenant_id: str
    warehouse_id: str


@register("KBWarehouse_Config", "delete")
class KBWarehouseConfigDelete(BaseModel):
    tenant_id: str
    config_id: str


@register("KBTable", "delete")
class KBTableDelete(BaseModel):
    tenant_id: str
    table_id: str


@register("KBTextBlock", "delete")
class KBTextBlockDelete(BaseModel):
    tenant_id: str
    block_id: str


@register("KBTextBlockVersion", "delete")
class KBTextBlockVersionDelete(BaseModel):
    tenant_id: str
    version_id: str


@register("KBTextTable", "delete")
class KBTextTableDelete(BaseModel):
    tenant_id: str
    version_id: str


@register("KBQdrantConnection", "delete")
class KBQdrantConnectionDelete(BaseModel):
    tenant_id: str
    connection_id: str


@register("KBQdrantCollection", "delete")
class KBQdrantCollectionDelete(BaseModel):
    tenant_id: str
    collection_id: str


@register("KBNeo4jConnection", "delete")
class KBNeo4jConnectionDelete(BaseModel):
    tenant_id: str
    connection_id: str


@register("KBNeo4jNode", "delete")
class KBNeo4jNodeDelete(BaseModel):
    tenant_id: str
    node_id: str


@register("KBNeo4jRelationship", "delete")
class KBNeo4jRelationshipDelete(BaseModel):
    tenant_id: str
    from_node: str
    to_node: str


@register("KBEntityLookup", "delete")
class KBEntityLookupDelete(BaseModel):
    tenant_id: str
    lookup_id: str


@register("KBPublishAPI", "delete")
class KBPublishAPIDelete(BaseModel):
    tenant_id: str
    id: str


# ── Join ──────────────────────────────────────────────────────────────────────


class SelectedColumn(BaseModel):
    table_name: str
    column_name: str
    alias: Optional[str] = None


class JoinOn(BaseModel):
    left_table: str
    left_column: str
    right_table: str
    right_column: str
    join_type: Literal["INNER", "LEFT", "RIGHT", "FULL"] = "INNER"


class WhereFilter(BaseModel):
    table_name: str
    column_name: str
    value: Any


class ReadJoinRequest(BaseModel):
    joins_table: list[str]
    join_on: list[JoinOn]
    selected_columns: list[SelectedColumn]
    filters: list[WhereFilter] = []
    limit: int = 50
    offset: int = 0
    order_by: Optional[str] = None

    @model_validator(mode="after")
    def _check_consistency(self):
        if len(self.joins_table) < 2:
            raise ValueError("joins_table must contain at least two table names")
        expected_joins = len(self.joins_table) - 1
        if len(self.join_on) != expected_joins:
            raise ValueError(
                f"join_on must have exactly {expected_joins} entry/entries "
                f"for {len(self.joins_table)} tables"
            )
        if not self.selected_columns:
            raise ValueError("selected_columns cannot be empty")
        table_set = set(self.joins_table)
        for col in self.selected_columns:
            if col.table_name not in table_set:
                raise ValueError(
                    f"selected_columns references unknown table '{col.table_name}'"
                )
        for f in self.filters:
            if f.table_name not in table_set:
                raise ValueError(
                    f"filters references unknown table '{f.table_name}'"
                )
        return self


"""
ORM
"""


class Base(DeclarativeBase):
    pass


@register("KBModel", "orm")
class KBModelORM(Base):
    __tablename__ = "KBModel"

    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)          # TaskType
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    versions: Mapped[list["KBModelVersionORM"]] = relationship(back_populates="model", cascade="all, delete-orphan")
    text_block_versions: Mapped[list["KBTextBlockVersionORM"]] = relationship(back_populates="embedding_model")
    qdrant_collections: Mapped[list["KBQdrantCollectionORM"]] = relationship(back_populates="embedding_model")
    neo4j_connections: Mapped[list["KBNeo4jConnectionORM"]] = relationship(back_populates="embedding_model")


@register("KBModelVersion", "orm")
class KBModelVersionORM(Base):
    __tablename__ = "KBModelVersion"

    # SERIAL pk — generated by DB
    version_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    added_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)        # ModelConfig
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    added_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    model: Mapped["KBModelORM"] = relationship(back_populates="versions")


@register("KBData", "orm")
class KBDataORM(Base):
    __tablename__ = "KBData"

    data_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    extension: Mapped[str] = mapped_column(String(32), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)           # Language
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)        # SourceType
    added_by: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    abstract: Mapped[str] = mapped_column(Text, nullable=False)
    doc_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False)  # MetadataType
    current_tier: Mapped[str] = mapped_column(String(16), default=Tier.BRONZE.value, nullable=False)  # Tier
    path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    added_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    lifecycle_histories: Mapped[list["KBLifecycleHistoryORM"]] = relationship(back_populates="data", cascade="all, delete-orphan")
    text_blocks: Mapped[list["KBTextBlockORM"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    tables: Mapped[list["KBTableORM"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


@register("KBLifecycleHistory", "orm")
class KBLifecycleHistoryORM(Base):
    __tablename__ = "KBLifecycleHistory"

    history_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    data_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    to_tier: Mapped[str] = mapped_column(String(16), nullable=False)            # Tier
    from_tier: Mapped[Optional[str]] = mapped_column(String(16), nullable=True) # Tier
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transitioned_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    data: Mapped["KBDataORM"] = relationship(back_populates="lifecycle_histories")


@register("KBFilterPolicy", "orm")
class KBFilterPolicyORM(Base):
    __tablename__ = "KBFilterPolicy"

    policy_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    configformat: Mapped[str] = mapped_column(String(64), nullable=False)       # PolicyFilteringType
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)        # PolicyConfig
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # Language
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBExtractionPolicy", "orm")
class KBExtractionPolicyORM(Base):
    __tablename__ = "KBExtractionPolicy"

    policy_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_type: Mapped[str] = mapped_column(String(64), nullable=False)        # PolicyExtractionType
    custom_override: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # Language
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBConflictBatch", "orm")
class KBConflictBatchORM(Base):
    __tablename__ = "KBConflictBatch"

    batch_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    batch_title: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=ConflictStatus.PENDING.value, nullable=False)  # ConflictStatus
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    conflicts: Mapped[list["KBConflictORM"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


@register("KBConflict", "orm")
class KBConflictORM(Base):
    __tablename__ = "KBConflict"

    conflict_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    conflict_type: Mapped[str] = mapped_column(String(64), nullable=False)      # ConflictType
    severity: Mapped[str] = mapped_column(String(16), nullable=False)           # ConflictSeverity
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBConflictBatch.batch_id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default=ConflictStatus.PENDING.value, nullable=False)  # ConflictStatus
    detailed_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    existing_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    incoming_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    resolution_instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    detected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    batch: Mapped[Optional["KBConflictBatchORM"]] = relationship(back_populates="conflicts")


@register("KBWarehouse", "orm")
class KBWarehouseORM(Base):
    __tablename__ = "KBWarehouse"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    service: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    configs: Mapped[list["KBWarehouseConfigORM"]] = relationship(back_populates="warehouse", cascade="all, delete-orphan")


@register("KBWarehouse_Config", "orm")
class KBWarehouseConfigORM(Base):
    __tablename__ = "KBWarehouse_Config"

    config_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBWarehouse.warehouse_id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)        # WarehouseConfigPayload
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    warehouse: Mapped["KBWarehouseORM"] = relationship(back_populates="configs")


@register("KBTable", "orm")
class KBTableORM(Base):
    __tablename__ = "KBTable"

    table_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    table_schema: Mapped[Optional[dict]] = mapped_column("schema", JSONB, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    owner: Mapped["KBDataORM"] = relationship(back_populates="tables")


@register("KBTextBlock", "orm")
class KBTextBlockORM(Base):
    __tablename__ = "KBTextBlock"

    block_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    block_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    owner: Mapped["KBDataORM"] = relationship(back_populates="text_blocks")
    versions: Mapped[list["KBTextBlockVersionORM"]] = relationship(back_populates="block", cascade="all, delete-orphan")


@register("KBTextBlockVersion", "orm")
class KBTextBlockVersionORM(Base):
    __tablename__ = "KBTextBlockVersion"

    version_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    block_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBTextBlock.block_id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    table_involved: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    block: Mapped["KBTextBlockORM"] = relationship(back_populates="versions")
    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="text_block_versions")
    text_table: Mapped[Optional["KBTextTableORM"]] = relationship(back_populates="version", uselist=False, cascade="all, delete-orphan")


@register("KBTextTable", "orm")
class KBTextTableORM(Base):
    __tablename__ = "KBTextTable"

    # provided pk — same UUID as the owning KBTextBlockVersion
    version_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBTextBlockVersion.version_id"), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    version: Mapped["KBTextBlockVersionORM"] = relationship(back_populates="text_table")


@register("KBQdrantConnection", "orm")
class KBQdrantConnectionORM(Base):
    __tablename__ = "KBQdrantConnection"

    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    total_collection: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    collections: Mapped[list["KBQdrantCollectionORM"]] = relationship(back_populates="connection", cascade="all, delete-orphan")


@register("KBQdrantCollection", "orm")
class KBQdrantCollectionORM(Base):
    __tablename__ = "KBQdrantCollection"

    collection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBQdrantConnection.connection_id"), nullable=False, index=True)
    collection_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    similarity_metric: Mapped[str] = mapped_column(String(16), default=SimilarityMetric.COSINE.value, nullable=False)  # SimilarityMetric
    points_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    vector_dimension: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    connection: Mapped["KBQdrantConnectionORM"] = relationship(back_populates="collections")
    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="qdrant_collections")


@register("KBNeo4jConnection", "orm")
class KBNeo4jConnectionORM(Base):
    __tablename__ = "KBNeo4jConnection"

    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    total_node: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    total_edge: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="neo4j_connections")
    nodes: Mapped[list["KBNeo4jNodeORM"]] = relationship(back_populates="connection", cascade="all, delete-orphan")


@register("KBNeo4jNode", "orm")
class KBNeo4jNodeORM(Base):
    __tablename__ = "KBNeo4jNode"

    node_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jConnection.connection_id"), nullable=False, index=True)
    node_name: Mapped[str] = mapped_column(String(512), nullable=False)
    node_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inserted_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    connection: Mapped["KBNeo4jConnectionORM"] = relationship(back_populates="nodes")
    outgoing_relationships: Mapped[list["KBNeo4jRelationshipORM"]] = relationship(
        back_populates="from_node_obj",
        foreign_keys="KBNeo4jRelationshipORM.from_node",
        cascade="all, delete-orphan",
    )
    incoming_relationships: Mapped[list["KBNeo4jRelationshipORM"]] = relationship(
        back_populates="to_node_obj",
        foreign_keys="KBNeo4jRelationshipORM.to_node",
        cascade="all, delete-orphan",
    )


@register("KBNeo4jRelationship", "orm")
class KBNeo4jRelationshipORM(Base):
    __tablename__ = "KBNeo4jRelationship"

    # compound provided pk
    from_node: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jNode.node_id"), primary_key=True)
    to_node: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jNode.node_id"), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    from_node_obj: Mapped["KBNeo4jNodeORM"] = relationship(back_populates="outgoing_relationships", foreign_keys=[from_node])
    to_node_obj: Mapped["KBNeo4jNodeORM"] = relationship(back_populates="incoming_relationships", foreign_keys=[to_node])


@register("KBEntityLookup", "orm")
class KBEntityLookupORM(Base):
    __tablename__ = "KBEntityLookup"

    lookup_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    alias_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    canonical_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBPublishAPI", "orm")
class KBPublishAPIORM(Base):
    __tablename__ = "KBPublishAPI"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)               # APIType
    endpoint_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    http_method: Mapped[str] = mapped_column(String(8), nullable=False)         # HttpMethod
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
