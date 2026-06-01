from pydantic import BaseModel
from .enum_type import *

class ContentCount(BaseModel):
    documents: int
    web: int
    media: int
    warehouses: int

# Response Model
# GET /api/fleet/stats
class FleetConfigure(BaseModel):
    content: ContentCount
    qdrant_collections: int
    neo4j_nodes: int
    neo4j_relationships: int
    unresolved_conflict_batches: int
