import datetime
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any, Annotated, Literal, Optional, Type, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

_ROLES = frozenset({"insert", "delete", "orm"})
_SUFFIXES = ("ORM", "Insert", "Delete")
_partial: dict[str, dict] = {}

Method = Literal["insert", "delete", "orm"]


@dataclass
class OperationSchema:
    insert: Type[BaseModel]
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



class PolicyExtractionType(Enum):
    ENTITY_NODE = "Entity"
    RELATIONSHIP_EDGE = "Relationship Edge"


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
Base Models
"""

class InsertModel(BaseModel):
    inserted_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )


class TenantInsertModel(InsertModel):
    tenant_id: str


class TenantModel(BaseModel):
    tenant_id: str


"""
Insert Models
tables with tenant_id extend TenantInsertModel; tables without extend InsertModel
"""

@register("insert")
class KBModelInsert(BaseModel):
    model_name: str
    task_type: TaskType
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBModelVersionInsert(BaseModel):
    model_id: str
    version_number: int
    added_by: Optional[str] = None
    config: Optional[ModelConfig] = None
    is_active: bool = False


@register("insert")
class KBDataInsert(TenantModel):
    role_id: str
    name: str
    extension: str
    language: Language
    source_type: SourceType
    added_by: str
    abstract: str
    doc_metadata: MetadataType
    current_tier: Tier = Tier.BRONZE
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBLifecycleHistoryInsert(BaseModel):
    data_id: str
    to_tier: Tier
    from_tier: Optional[Tier] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBFilterPolicyInsert(TenantModel):
    policy_name: str
    configformat: PolicyFilteringType
    config: Optional[PolicyConfig] = None
    is_active: bool = False
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBExtractionPolicyInsert(TenantModel):
    policy_name: str
    policy_type: PolicyExtractionType
    custom_override: Optional[str] = None
    created_by: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBConflictBatchInsert(TenantModel):
    batch_title: str
    status: ConflictStatus = ConflictStatus.PENDING
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBConflictInsert(TenantModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    batch_id: Optional[str] = None
    status: ConflictStatus = ConflictStatus.PENDING
    detailed_explanation: Optional[str] = None
    existing_snapshot: Optional[dict[str, Any]] = None
    incoming_snapshot: Optional[dict[str, Any]] = None
    resolution_instruction: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBWarehouseInsert(BaseModel):
    service: str
    description: Optional[str] = None


@register("insert")
class KBWarehouseConfigInsert(BaseModel):
    warehouse_id: str
    version_number: int
    is_active: bool = False
    config: Optional[WarehouseConfigPayload] = None
    created_by: Optional[str] = None


@register("insert")
class KBTableInsert(BaseModel):
    owner_id: str
    table_name: str
    description: Optional[str] = None
    table_schema: Optional[dict[str, Any]] = None
    created_by: Optional[str] = None


@register("insert")
class KBTextBlockInsert(BaseModel):
    owner_id: str
    block_index: int


@register("insert")
class KBTextBlockVersionInsert(BaseModel):
    block_id: str
    version_number: int
    content: Optional[str] = None
    created_by: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    is_active: bool = False


@register("insert")
class KBTextTableInsert(BaseModel):
    version_id: str
    table_name: str
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


@register("insert")
class KBQdrantConnectionInsert(TenantModel):
    is_active: bool = False
    total_collection: int = 0


@register("insert")
class KBQdrantCollectionInsert(BaseModel):
    connection_id: str
    collection_name: str
    is_active: bool = False
    similarity_metric: SimilarityMetric = SimilarityMetric.COSINE
    points_count: int = 0
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


@register("insert")
class KBNeo4jConnectionInsert(TenantModel):
    is_connected: bool = False
    total_node: int = 0
    total_edge: int = 0
    embedding_model_id: Optional[str] = None


@register("insert")
class KBNeo4jNodeInsert(BaseModel):
    connection_id: str
    node_name: str
    node_description: Optional[str] = None


@register("insert")
class KBNeo4jRelationshipInsert(BaseModel):
    from_node: str
    to_node: str
    score: Optional[float] = None
    description: Optional[str] = None


@register("insert")
class KBEntityLookupInsert(BaseModel):
    alias_name: str
    canonical_name: str


@register("insert")
class KBPublishAPIInsert(TenantModel):
    name: str
    type: APIType
    endpoint_url: str
    http_method: HttpMethod
    is_published: bool = False
    model_config = ConfigDict(use_enum_values=True)


"""
Delete Models — PK fields only
"""


@register("delete")
class KBModelDelete(BaseModel):
    model_id: str


@register("delete")
class KBModelVersionDelete(BaseModel):
    version_id: int


@register("delete")
class KBDataDelete(TenantModel):
    data_id: str


@register("delete")
class KBLifecycleHistoryDelete(BaseModel):
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
class KBWarehouseDelete(BaseModel):
    warehouse_id: str


@register("delete")
class KBWarehouseConfigDelete(BaseModel):
    config_id: str


@register("delete")
class KBTableDelete(BaseModel):
    table_id: str


@register("delete")
class KBTextBlockDelete(BaseModel):
    block_id: str


@register("delete")
class KBTextBlockVersionDelete(BaseModel):
    version_id: str


@register("delete")
class KBTextTableDelete(BaseModel):
    version_id: str


@register("delete")
class KBQdrantConnectionDelete(TenantModel):
    connection_id: str


@register("delete")
class KBQdrantCollectionDelete(BaseModel):
    collection_id: str


@register("delete")
class KBNeo4jConnectionDelete(TenantModel):
    connection_id: str


@register("delete")
class KBNeo4jNodeDelete(BaseModel):
    node_id: str


@register("delete")
class KBNeo4jRelationshipDelete(BaseModel):
    from_node: str
    to_node: str


@register("delete")
class KBEntityLookupDelete(BaseModel):
    lookup_id: str


@register("delete")
class KBPublishAPIDelete(TenantModel):
    id: str


"""
Read — generic join request (also handles single-table reads)
"""


class SelectedColumn(BaseModel):
    table_name: str
    column_name: str
    alias: Optional[str] = None


class WhereFilter(BaseModel):
    table_name: str
    column_name: str
    value: Any


class SelectInLoadRequest(BaseModel):
    tenant_id: Optional[str] = None
    table: str
    load_paths: list[str]               # table name dot-notation e.g. ["KBTextBlock.KBTextBlockVersion", "KBTable"]
    filters: list[WhereFilter] = []
    limit: int = 50
    cursor: Optional[datetime.datetime] = None


class ReadJoinRequest(BaseModel):
    tenant_id: Optional[str] = None
    joins_table: list[str]
    selected_columns: list[SelectedColumn] = []
    filters: list[WhereFilter] = []
    limit: int = 50
    cursor: Optional[datetime.datetime] = None
    order_by: Optional[str] = None

    @model_validator(mode="after")
    def _check_consistency(self):
        if not self.joins_table:
            raise ValueError("joins_table must contain at least one table name")
        table_set = set(self.joins_table)
        for col in self.selected_columns:
            if col.table_name not in table_set:
                raise ValueError(f"selected_columns references unknown table '{col.table_name}'")
        for f in self.filters:
            if f.table_name not in table_set:
                raise ValueError(f"filters references unknown table '{f.table_name}'")
        return self
