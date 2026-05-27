from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, List
import uuid
from .enums import *

class NodePayload(BaseModel):
    block_id: uuid.UUID
    tenant_id: uuid.UUID
    data_id: uuid.UUID
    description: str

class NodeData(BaseModel):
    label: str
    properties: NodePayload
    embedding: Optional[list[float]] = None

class RelationshipData(BaseModel):
    type: str
    properties: Optional[dict[str, Any]] = None
    direction: RelationshipDirection = RelationshipDirection.OUTGOING

    model_config = ConfigDict(use_enum_values=True)