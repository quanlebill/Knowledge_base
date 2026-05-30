from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, List
import uuid
from .enums import *
from .base_struct import RelationshipData, NodeData


# API Request
class AddNodeRequest(BaseModel):
    node: NodeData

class AddRelationshipRequest(BaseModel):
    from_node_id: str
    to_node_id: str
    relationship: RelationshipData

class GraphExpandRequest(BaseModel):
    start_node_id: str
    max_hops: int = 1
    max_neighbours: int = 10
    query_vector: Optional[list[float]] = None
