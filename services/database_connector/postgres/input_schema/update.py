from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
import uuid

from .enums import (
    Language, Tier, PolicyFormat, PolicyType,
    ConflictStatus, TaskType, SimilarityMetric, HttpMethod, APIType,
)
from .base_struct import MetadataType, PolicyConfig, WarehouseConfigPayload, ModelConfig


class KBModelUpdate(BaseModel):
    model_id: uuid.UUID
    model_name: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


class KBModelVersionUpdate(BaseModel):
    version_id: int
    config: Optional[ModelConfig] = None
    is_active: Optional[bool] = None


class KBDataUpdate(BaseModel):
    data_id: uuid.UUID
    name: Optional[str] = None
    extension: Optional[str] = None
    language: Optional[Language] = None
    current_tier: Optional[Tier] = None
    abstract: Optional[str] = None
    metadata: Optional[MetadataType] = None
    path: Optional[str] = None
    model_config = ConfigDict(use_enum_values=True)


class KBLifecycleHistoryUpdate(BaseModel):
    history_id: uuid.UUID
    notes: Optional[str] = None


class KBFilterPolicyUpdate(BaseModel):
    policy_id: uuid.UUID
    policy_name: Optional[str] = None
    configformat: Optional[PolicyFormat] = None
    config: Optional[PolicyConfig] = None
    is_active: Optional[bool] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBExtractionPolicyUpdate(BaseModel):
    policy_id: uuid.UUID
    policy_name: Optional[str] = None
    policy_type: Optional[PolicyType] = None
    custom_override: Optional[str] = None
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBConflictUpdate(BaseModel):
    conflict_id: uuid.UUID
    status: Optional[ConflictStatus] = None
    resolution_instruction: Optional[str] = None
    resolved_by: Optional[uuid.UUID] = None
    model_config = ConfigDict(use_enum_values=True)


class KBWarehouseUpdate(BaseModel):
    warehouse_id: uuid.UUID
    service: Optional[str] = None
    description: Optional[str] = None


class KBWarehouseConfigUpdate(BaseModel):
    config_id: uuid.UUID
    config: Optional[WarehouseConfigPayload] = None
    is_active: Optional[bool] = None


class KBTableUpdate(BaseModel):
    table_id: uuid.UUID
    table_name: Optional[str] = None
    description: Optional[str] = None
    schema: Optional[dict[str, Any]] = None


class KBTextBlockUpdate(BaseModel):
    block_id: uuid.UUID
    block_index: Optional[int] = None


class KBTextBlockVersionUpdate(BaseModel):
    version_id: uuid.UUID
    content: Optional[str] = None
    table_involved: Optional[bool] = None
    embedding_model_id: Optional[uuid.UUID] = None
    payload: Optional[dict[str, Any]] = None


class KBTextTableUpdate(BaseModel):
    version_id: uuid.UUID
    table_name: Optional[str] = None
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class KBQdrantConnectionUpdate(BaseModel):
    connection_id: uuid.UUID
    is_active: Optional[bool] = None
    total_collection: Optional[int] = None


class KBQdrantCollectionUpdate(BaseModel):
    collection_id: uuid.UUID
    is_active: Optional[bool] = None
    similarity_metric: Optional[SimilarityMetric] = None
    points_count: Optional[int] = None
    vector_dimension: Optional[int] = None
    embedding_model_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(use_enum_values=True)


class KBNeo4jConnectionUpdate(BaseModel):
    connection_id: uuid.UUID
    is_connected: Optional[bool] = None
    total_node: Optional[int] = None
    total_edge: Optional[int] = None
    embedding_model_id: Optional[uuid.UUID] = None


class KBNeo4jNodeUpdate(BaseModel):
    node_id: uuid.UUID
    node_name: Optional[str] = None
    node_description: Optional[str] = None


class KBNeo4jRelationshipUpdate(BaseModel):
    from_node: uuid.UUID
    to_node: uuid.UUID
    score: Optional[float] = None
    description: Optional[str] = None


class KBEntityLookupUpdate(BaseModel):
    lookup_id: uuid.UUID
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None


class KBPublishAPIUpdate(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    type: Optional[APIType] = None
    endpoint_url: Optional[str] = None
    http_method: Optional[HttpMethod] = None
    is_published: Optional[bool] = None
    model_config = ConfigDict(use_enum_values=True)
