from typing import Literal
from pydantic import BaseModel

class IngestMetadata(BaseModel):
    tenant: str
    type: str
    language: str

#Request models
# POST /api/data/documents
class RequestIngestDocument(BaseModel):
    name: str
    layer: Literal["BRONZE"]
    author: str
    metadata: IngestMetadata

#Response models
# POST /api/data/documents
class IngestConfigure(BaseModel):
    id: str
    name: str
    layer: Literal["BRONZE"]
    status: str
    version: str
    last_updated: str
    author: str
    metadata: IngestMetadata
