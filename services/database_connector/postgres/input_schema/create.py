from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
import uuid

from .enums import (
    Language, SourceType, Tier, PolicyFormat, PolicyType,
    ConflictType, ConflictSeverity, ConflictStatus,
    TaskType, SimilarityMetric, HttpMethod, APIType,
)
from .base_struct import MetadataType, PolicyConfig, WarehouseConfigPayload, ModelConfig


class KBModelCreate(BaseModel):
    model_name: str
    task_type: TaskType
    model_config = ConfigDict(use_enum_values=True)


class KBModelVersionCreate(BaseModel):
    model_id: uuid.UUID
    version_number: int
    added_by: Optional[uuid.UUID] = None
    config: Optional[ModelConfig] = None
    is_active: bool = False


class KBDataCreate(BaseModel):
    tenant_id: uuid.UUID
    role_id: uuid.UUID
    name: str
    extension: str
    language: Language
    source_type: SourceType
    added_by: uuid.UUID
    abstract: str
    metadata: MetadataType
    current_tier: Tier = Tier.BRONZE
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


class KBLifecycleHistoryCreate(BaseModel):
    data_id: uuid.UUID
    to_tier: Tier
    from_tier: Optional[Tier] = None
    approved_by: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


class KBFilterPolicyCreate(BaseModel):
    tenant_id: uuid.UUID
    policy_name: str
    configformat: PolicyFormat
    config: Optional[PolicyConfig] = None
    is_active: bool = False
    created_by: Optional[uuid.UUID] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBExtractionPolicyCreate(BaseModel):
    tenant_id: uuid.UUID
    policy_name: str
    policy_type: PolicyType
    custom_override: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBConflictCreate(BaseModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    tenant_id: Optional[uuid.UUID] = None
    status: ConflictStatus = ConflictStatus.PENDING
    detailed_explanation: Optional[str] = None
    existing_snapshot: Optional[dict[str, Any]] = None
    incoming_snapshot: Optional[dict[str, Any]] = None
    resolution_instruction: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


class KBWarehouseCreate(BaseModel):
    service: str
    description: Optional[str] = None


class KBWarehouseConfigCreate(BaseModel):
    warehouse_id: uuid.UUID
    version_number: int
    is_active: bool = False
    config: Optional[WarehouseConfigPayload] = None
    created_by: Optional[uuid.UUID] = None


class KBTableCreate(BaseModel):
    owner_id: uuid.UUID
    table_name: str
    description: Optional[str] = None
    schema: Optional[dict[str, Any]] = None
    created_by: Optional[uuid.UUID] = None


class KBTextBlockCreate(BaseModel):
    owner_id: uuid.UUID
    block_index: int


class KBTextBlockVersionCreate(BaseModel):
    block_id: uuid.UUID
    version_number: int
    content: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[uuid.UUID] = None
    payload: Optional[dict[str, Any]] = None


class KBTextTableCreate(BaseModel):
    version_id: uuid.UUID
    table_name: str
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class KBQdrantConnectionCreate(BaseModel):
    tenant_id: uuid.UUID
    is_active: bool = False
    total_collection: int = 0


class KBQdrantCollectionCreate(BaseModel):
    connection_id: uuid.UUID
    collection_name: str
    is_active: bool = False
    similarity_metric: SimilarityMetric = SimilarityMetric.COSINE
    points_count: int = 0
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(use_enum_values=True)


class KBNeo4jConnectionCreate(BaseModel):
    tenant_id: uuid.UUID
    is_connected: bool = False
    total_node: int = 0
    total_edge: int = 0
    embedding_model_id: Optional[uuid.UUID] = None


class KBNeo4jNodeCreate(BaseModel):
    connection_id: uuid.UUID
    node_name: str
    node_description: Optional[str] = None


class KBNeo4jRelationshipCreate(BaseModel):
    from_node: uuid.UUID
    to_node: uuid.UUID
    score: Optional[float] = None
    description: Optional[str] = None


class KBEntityLookupCreate(BaseModel):
    alias_name: str
    canonical_name: str


class KBPublishAPICreate(BaseModel):
    tenant_id: uuid.UUID
    name: str
    type: APIType
    endpoint_url: str
    http_method: HttpMethod
    is_published: bool = False
    model_config = ConfigDict(use_enum_values=True)
