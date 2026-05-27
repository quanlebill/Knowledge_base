from pydantic import BaseModel, ConfigDict
from typing import Optional
import uuid

from .enums import (
    Language, SourceType, Tier, PolicyFormat,
    ConflictSeverity, ConflictStatus, TaskType, SimilarityMetric, APIType,
)


class KBModelRead(BaseModel):
    task_type: Optional[TaskType] = None
    limit: int = 50
    offset: int = 0
    model_config = ConfigDict(use_enum_values=True)


class KBModelVersionRead(BaseModel):
    model_id: uuid.UUID
    is_active: Optional[bool] = None


class KBDataRead(BaseModel):
    tenant_id: uuid.UUID
    source_type: Optional[SourceType] = None
    role_id: Optional[uuid.UUID] = None
    current_tier: Optional[Tier] = None
    limit: int = 50
    offset: int = 0
    model_config = ConfigDict(use_enum_values=True)


class KBLifecycleHistoryRead(BaseModel):
    data_id: uuid.UUID


class KBFilterPolicyRead(BaseModel):
    tenant_id: uuid.UUID
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBExtractionPolicyRead(BaseModel):
    tenant_id: uuid.UUID
    language: Optional[Language] = None
    model_config = ConfigDict(use_enum_values=True)


class KBConflictRead(BaseModel):
    tenant_id: uuid.UUID
    status: Optional[ConflictStatus] = None
    severity: Optional[ConflictSeverity] = None
    limit: int = 50
    offset: int = 0
    model_config = ConfigDict(use_enum_values=True)


class KBWarehouseRead(BaseModel):
    limit: int = 50
    offset: int = 0


class KBWarehouseConfigRead(BaseModel):
    warehouse_id: uuid.UUID
    is_active: Optional[bool] = None


class KBTableRead(BaseModel):
    owner_id: Optional[uuid.UUID] = None
    table_name: Optional[str] = None


class KBTextBlockRead(BaseModel):
    owner_id: uuid.UUID


class KBTextBlockVersionRead(BaseModel):
    block_id: uuid.UUID
    is_active: Optional[bool] = None


class KBTextTableRead(BaseModel):
    version_id: uuid.UUID


class KBQdrantConnectionRead(BaseModel):
    tenant_id: uuid.UUID
    is_active: Optional[bool] = None


class KBQdrantCollectionRead(BaseModel):
    connection_id: uuid.UUID
    is_active: Optional[bool] = None


class KBNeo4jConnectionRead(BaseModel):
    tenant_id: uuid.UUID
    is_connected: Optional[bool] = None


class KBNeo4jNodeRead(BaseModel):
    connection_id: uuid.UUID


class KBNeo4jRelationshipRead(BaseModel):
    from_node: Optional[uuid.UUID] = None
    to_node: Optional[uuid.UUID] = None


class KBEntityLookupRead(BaseModel):
    alias_name: Optional[str] = None
    canonical_name: Optional[str] = None


class KBPublishAPIRead(BaseModel):
    tenant_id: uuid.UUID
    is_published: Optional[bool] = None
