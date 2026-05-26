from pydantic import BaseModel
from enum_type import *

# - Request
# POST /api/knowledge/policies/filtering
# PUT  /api/knowledge/policies/filtering/:id
class RequestSaveFilterPolicy(BaseModel):
    name: str
    type: str
    content: str
    added_by: str
    added_when: str
    active: bool

# PUT /api/knowledge/policies/extraction/custom
class RequestUpdateExtractionPolicy(BaseModel):
    content: str


# - Response models
# GET /api/knowledge/policies/filtering
# POST/PUT /api/knowledge/policies/filtering
class FilterPolicyConfigure(BaseModel):
    id: str
    name: str
    type: str
    content: str
    added_by: str
    added_when: str
    active: bool

# GET /api/knowledge/policies/extraction
class ExtractionPolicyConfigure(BaseModel):
    content: str
    last_modified_by: str
    last_modified_at: str
