from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from typing import List, Dict
from services.database_connector.Qdrant.API_model.enum_type import *


class CreateCollectionRequest(BaseModel):
    name: str
    vector_size: int = 128
    distance_metric: DistanceMetric = DistanceMetric.Cosine
    model_config = ConfigDict(use_enum_values=True)


class PointData(BaseModel):
    id: int | str
    vector: list[float]
    payload: Optional[dict[str, Any]] = None


class AddPointsRequest(BaseModel):
    collection_name: str
    points: list[PointData]


class UpdatePayloadRequest(BaseModel):
    collection_name: str
    point_ids: list[int | str]
    payload: dict[str, Any]


# Delete, search, query with matching condition
class MatchingPayload(BaseModel):
    field: str
    values: List[Any]

class QueryByPayloadRequest(BaseModel):
    collection_name: str
    matching_payload: List[MatchingPayload] | None = None
    limit: int = 10
    match_type: MatchType = MatchType.must

    model_config = ConfigDict(use_enum_values=True)

class DeletePointsRequest(BaseModel):
    collection_name: str
    point_ids: Optional[list[int | str]] = None
    matching_payload: List[MatchingPayload] | None = None

class SearchRequest(BaseModel):
    collection_name: str
    query_vector: list[float]
    limit: int = 10
    matching_payload: List[MatchingPayload] | None = None