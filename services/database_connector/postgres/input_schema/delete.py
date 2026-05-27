from pydantic import BaseModel
import uuid


class KBModelDelete(BaseModel):
    model_id: uuid.UUID


class KBModelVersionDelete(BaseModel):
    version_id: int


class KBDataDelete(BaseModel):
    data_id: uuid.UUID


class KBLifecycleHistoryDelete(BaseModel):
    history_id: uuid.UUID


class KBFilterPolicyDelete(BaseModel):
    policy_id: uuid.UUID


class KBExtractionPolicyDelete(BaseModel):
    policy_id: uuid.UUID


class KBConflictDelete(BaseModel):
    conflict_id: uuid.UUID


class KBWarehouseDelete(BaseModel):
    warehouse_id: uuid.UUID


class KBWarehouseConfigDelete(BaseModel):
    config_id: uuid.UUID


class KBTableDelete(BaseModel):
    table_id: uuid.UUID


class KBTextBlockDelete(BaseModel):
    block_id: uuid.UUID


class KBTextBlockVersionDelete(BaseModel):
    version_id: uuid.UUID


class KBTextTableDelete(BaseModel):
    version_id: uuid.UUID


class KBQdrantConnectionDelete(BaseModel):
    connection_id: uuid.UUID


class KBQdrantCollectionDelete(BaseModel):
    collection_id: uuid.UUID


class KBNeo4jConnectionDelete(BaseModel):
    connection_id: uuid.UUID


class KBNeo4jNodeDelete(BaseModel):
    node_id: uuid.UUID


class KBNeo4jRelationshipDelete(BaseModel):
    from_node: uuid.UUID
    to_node: uuid.UUID


class KBEntityLookupDelete(BaseModel):
    lookup_id: uuid.UUID


class KBPublishAPIDelete(BaseModel):
    id: uuid.UUID
