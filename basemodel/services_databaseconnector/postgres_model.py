import datetime
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any, Annotated, Literal, Optional, Type, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

_ROLES = frozenset({"create", "read", "update", "delete", "orm"})
_SUFFIXES = ("ORM", "Create", "Read", "Update", "Delete")
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


def register(method: Method):
    def decorator(cls: type) -> type:
        table = cls.__name__
        for suffix in _SUFFIXES:
            if table.endswith(suffix):
                table = table[:-len(suffix)]
                break
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


class DMLPreparation(BaseModel):
    instance: Any | None = None
    orm_cls: Any | None = None
    table_name: str | None = None
    compiled_query: Any | None = None

class DQLPreparation(BaseModel):
    compiled_query: Any

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
class TenantModel(BaseModel):
    tenant_id: str



@register("create")
class KBModelCreate(TenantModel):
    model_name: str
    task_type: TaskType
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBModelVersionCreate(TenantModel):
    model_id: str
    version_number: int
    added_by: Optional[str] = None
    config: Optional[ModelConfig] = None
    is_active: bool = False


@register("create")
class KBDataCreate(TenantModel):
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


@register("create")
class KBLifecycleHistoryCreate(TenantModel):
    data_id: str
    to_tier: Tier
    from_tier: Optional[Tier] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBFilterPolicyCreate(TenantModel):
    policy_name: str
    configformat: PolicyFormat
    config: Optional[PolicyConfig] = None
    is_active: bool = False
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBExtractionPolicyCreate(TenantModel):
    policy_name: str
    policy_type: PolicyType
    custom_override: Optional[str] = None
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBConflictBatchCreate(TenantModel):
    batch_title: str
    status: ConflictStatus = ConflictStatus.PENDING
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBConflictCreate(TenantModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    batch_id: Optional[str] = None
    status: ConflictStatus = ConflictStatus.PENDING
    detailed_explanation: Optional[str] = None
    existing_snapshot: Optional[dict[str, Any]] = None
    incoming_snapshot: Optional[dict[str, Any]] = None
    resolution_instruction: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBWarehouseCreate(TenantModel):
    service: str
    description: Optional[str] = None


@register("create")
class KBWarehouseConfigCreate(TenantModel):
    warehouse_id: str
    version_number: int
    is_active: bool = False
    config: Optional[WarehouseConfigPayload] = None
    created_by: Optional[str] = None


@register("create")
class KBTableCreate(TenantModel):
    owner_id: str
    table_name: str
    description: Optional[str] = None
    table_schema: Optional[dict[str, Any]] = None
    created_by: Optional[str] = None


@register("create")
class KBTextBlockCreate(TenantModel):
    owner_id: str
    block_index: int


@register("create")
class KBTextBlockVersionCreate(TenantModel):
    block_id: str
    version_number: int
    content: Optional[str] = None
    created_by: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


@register("create")
class KBTextTableCreate(TenantModel):
    version_id: str
    table_name: str
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


@register("create")
class KBQdrantConnectionCreate(TenantModel):
    is_active: bool = False
    total_collection: int = 0


@register("create")
class KBQdrantCollectionCreate(TenantModel):
    connection_id: str
    collection_name: str
    is_active: bool = False
    similarity_metric: SimilarityMetric = SimilarityMetric.COSINE
    points_count: int = 0
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("create")
class KBNeo4jConnectionCreate(TenantModel):
    is_connected: bool = False
    total_node: int = 0
    total_edge: int = 0
    embedding_model_id: Optional[str] = None


@register("create")
class KBNeo4jNodeCreate(TenantModel):
    connection_id: str
    node_name: str
    node_description: Optional[str] = None


@register("create")
class KBNeo4jRelationshipCreate(TenantModel):
    from_node: str
    to_node: str
    score: Optional[float] = None
    description: Optional[str] = None


@register("create")
class KBEntityLookupCreate(TenantModel):
    alias_name: str
    canonical_name: str


@register("create")
class KBPublishAPICreate(TenantModel):
    name: str
    type: APIType
    endpoint_url: str
    http_method: HttpMethod
    is_published: bool = False
    model_config = ConfigDict(use_enum_values=True)

@register("read")
class KBModelRead(TenantModel):
    task_type: Optional[TaskType] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBModelVersionRead(TenantModel):
    model_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBDataRead(TenantModel):
    data_id: Optional[str] = None
    source_type: Optional[SourceType] = None
    role_id: Optional[str] = None
    current_tier: Optional[Tier] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBLifecycleHistoryRead(TenantModel):
    data_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBFilterPolicyRead(TenantModel):
    language: Optional[Language] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBExtractionPolicyRead(TenantModel):
    language: Optional[Language] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBConflictBatchRead(TenantModel):
    status: Optional[ConflictStatus] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBConflictRead(TenantModel):
    batch_id: Optional[str] = None
    status: Optional[ConflictStatus] = None
    severity: Optional[ConflictSeverity] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None
    model_config = ConfigDict(use_enum_values=True)


@register("read")
class KBWarehouseRead(TenantModel):
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBWarehouseConfigRead(TenantModel):
    warehouse_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBTableRead(TenantModel):
    owner_id: Optional[str] = None
    table_name: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBTextBlockRead(TenantModel):
    owner_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBTextBlockVersionRead(TenantModel):
    block_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBTextTableRead(TenantModel):
    version_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBQdrantConnectionRead(TenantModel):
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBQdrantCollectionRead(TenantModel):
    connection_id: str
    is_active: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBNeo4jConnectionRead(TenantModel):
    is_connected: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBNeo4jNodeRead(TenantModel):
    connection_id: str
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBNeo4jRelationshipRead(TenantModel):
    from_node: Optional[str] = None
    to_node: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBEntityLookupRead(TenantModel):
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None


@register("read")
class KBPublishAPIRead(TenantModel):
    is_published: Optional[bool] = None
    limit: int = 10
    pagination_cursor: datetime.datetime | None = None





@register("update")
class KBModelUpdate(TenantModel):
    model_id: str
    model_name: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBModelVersionUpdate(TenantModel):
    version_id: int
    config: Optional[ModelConfig] = None
    is_active: Optional[bool] = None


@register("update")
class KBDataUpdate(TenantModel):
    data_id: str
    name: Optional[str] = None
    extension: Optional[str] = None
    language: Optional[Language] = None
    current_tier: Optional[Tier] = None
    abstract: Optional[str] = None
    metadata: Optional[MetadataType] = None
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBLifecycleHistoryUpdate(TenantModel):
    history_id: str
    notes: Optional[str] = None


@register("update")
class KBFilterPolicyUpdate(TenantModel):
    policy_id: str
    policy_name: Optional[str] = None
    configformat: Optional[PolicyFormat] = None
    config: Optional[PolicyConfig] = None
    is_active: Optional[bool] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBExtractionPolicyUpdate(TenantModel):
    policy_id: str
    policy_name: Optional[str] = None
    policy_type: Optional[PolicyType] = None
    custom_override: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBConflictBatchUpdate(TenantModel):
    batch_id: str
    batch_title: Optional[str] = None
    status: Optional[ConflictStatus] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBConflictUpdate(TenantModel):
    conflict_id: str
    batch_id: Optional[str] = None
    status: Optional[ConflictStatus] = None
    resolution_instruction: Optional[str] = None
    resolved_by: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBWarehouseUpdate(TenantModel):
    warehouse_id: str
    service: Optional[str] = None
    description: Optional[str] = None


@register("update")
class KBWarehouseConfigUpdate(TenantModel):
    config_id: str
    config: Optional[WarehouseConfigPayload] = None
    is_active: Optional[bool] = None


@register("update")
class KBTableUpdate(TenantModel):
    table_id: str
    table_name: Optional[str] = None
    description: Optional[str] = None
    table_schema: Optional[dict[str, Any]] = None


@register("update")
class KBTextBlockUpdate(TenantModel):
    block_id: str
    block_index: Optional[int] = None


@register("update")
class KBTextBlockVersionUpdate(TenantModel):
    version_id: str
    is_active: Optional[bool] = None
    content: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


@register("update")
class KBTextTableUpdate(TenantModel):
    version_id: str
    table_name: Optional[str] = None
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


@register("update")
class KBQdrantConnectionUpdate(TenantModel):
    connection_id: str
    is_active: Optional[bool] = None
    total_collection: Optional[int] = None


@register("update")
class KBQdrantCollectionUpdate(TenantModel):
    collection_id: str
    is_active: Optional[bool] = None
    similarity_metric: Optional[SimilarityMetric] = None
    points_count: Optional[int] = None
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("update")
class KBNeo4jConnectionUpdate(TenantModel):
    connection_id: str
    is_connected: Optional[bool] = None
    total_node: Optional[int] = None
    total_edge: Optional[int] = None
    embedding_model_id: Optional[str] = None


@register("update")
class KBNeo4jNodeUpdate(TenantModel):
    node_id: str
    node_name: Optional[str] = None
    node_description: Optional[str] = None


@register("update")
class KBNeo4jRelationshipUpdate(TenantModel):
    from_node: str
    to_node: str
    score: Optional[float] = None
    description: Optional[str] = None


@register("update")
class KBEntityLookupUpdate(TenantModel):
    lookup_id: str
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None


@register("update")
class KBPublishAPIUpdate(TenantModel):
    id: str
    name: Optional[str] = None
    type: Optional[APIType] = None
    endpoint_url: Optional[str] = None
    http_method: Optional[HttpMethod] = None
    is_published: Optional[bool] = None
    model_config = ConfigDict(use_enum_values=True)



@register("delete")
class KBModelDelete(TenantModel):
    model_id: str


@register("delete")
class KBModelVersionDelete(TenantModel):
    version_id: int


@register("delete")
class KBDataDelete(TenantModel):
    data_id: str


@register("delete")
class KBLifecycleHistoryDelete(TenantModel):
    history_id: str


@register("delete")
class KBFilterPolicyDelete(TenantModel):
    policy_id: str


@register("delete")
class KBExtractionPolicyDelete(TenantModel):
    policy_id: str


@register("delete")
class KBConflictBatchDelete(TenantModel):
    batch_id: str


@register("delete")
class KBConflictDelete(TenantModel):
    conflict_id: str


@register("delete")
class KBWarehouseDelete(TenantModel):
    warehouse_id: str


@register("delete")
class KBWarehouseConfigDelete(TenantModel):
    config_id: str


@register("delete")
class KBTableDelete(TenantModel):
    table_id: str


@register("delete")
class KBTextBlockDelete(TenantModel):
    block_id: str


@register("delete")
class KBTextBlockVersionDelete(TenantModel):
    version_id: str


@register("delete")
class KBTextTableDelete(TenantModel):
    version_id: str


@register("delete")
class KBQdrantConnectionDelete(TenantModel):
    connection_id: str


@register("delete")
class KBQdrantCollectionDelete(TenantModel):
    collection_id: str


@register("delete")
class KBNeo4jConnectionDelete(TenantModel):
    connection_id: str

@register("delete")
class KBNeo4jNodeDelete(TenantModel):
    node_id: str


@register("delete")
class KBNeo4jRelationshipDelete(TenantModel):
    from_node: str
    to_node: str


@register("delete")
class KBEntityLookupDelete(TenantModel):
    lookup_id: str


@register("delete")
class KBPublishAPIDelete(TenantModel):
    id: str

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


class ReadJoinRequest(TenantModel):
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


