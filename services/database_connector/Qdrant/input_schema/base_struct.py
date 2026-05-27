from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from typing import List, Dict
from .enums import *
import uuid

# Point Data Requirement
class PointPayload(BaseModel):
    tenant_id: uuid.UUID
    block_id: uuid.UUID
    data_id: uuid.UUID
    summary: str
    entities: List[str]
    intents: List[str]

class PointData(BaseModel):
    id: int | str
    vector: list[float]
    payload: PointPayload

class MatchingPayload(BaseModel):
    field: str
    values: List[Any]