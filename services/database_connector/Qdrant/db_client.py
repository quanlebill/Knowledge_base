from qdrant_client import models
import qdrant_client
from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import ResponseModel, Success, Error

from fastapi import APIRouter, FastAPI
from api_schema.request import *
from api_schema.enums import *


client = qdrant_client.AsyncQdrantClient(
    host=DBConfig.QDRANT_HOST,
    port=DBConfig.QDRANT_PORT,
    grpc_port=DBConfig.QDRANT_GRPC_PORT)

router = APIRouter(prefix='/qdrant')

# Utilities
def build_matching_field(data: List[MatchingPayload]) -> list[models.FieldCondition]:
    """
    matching_field:
    [
        {
            "field": "name",
            "value": [list of value]
        },

    ]
    """

    matching_field = []
    for matching_entity in data:
        for value in matching_entity.values:
            matching_field.append(
                models.FieldCondition(
                    key = matching_entity.field,
                    match = models.MatchValue(value=value),
                )
            )
    return matching_field


# API router

@router.post("/create_collection", response_model=ResponseModel)
async def create_qdrant_collection(item: CreateCollectionRequest):
    # Creating Collection
    if await client.collection_exists(item.name):
        return Error(code = 409, error="Collection already exists")

    if item.distance_metric not in DistanceMetric:
        return Error(code = 404, error="Distance metric does not exist")

    distance = models.Distance.COSINE
    if item.distance_metric == DistanceMetric.Euclidean.value:
        distance = models.Distance.EUCLID
    elif item.distance_metric == DistanceMetric.Dot.value:
        distance = models.Distance.DOT

    await client.create_collection(
        collection_name=item.name,
        vectors_config = models.VectorParams(
            size = item.vector_size,
            distance = distance,
        )
    )

    return Success()

@router.patch("/update_payload", response_model=ResponseModel)
async def update_payload(item: UpdatePayloadRequest):
    #Updaing Payload for specific list of points
    if not await client.collection_exists(item.collection_name):
        return Error(code = 404, error = "Collection does not exist")

    await client.set_payload(
        collection_name = item.collection_name,
        payload = item.payload,
        points = item.point_ids,
    )

    return Success()

@router.post("/add_points", response_model=ResponseModel)
async def add_points(item: AddPointsRequest):
    # Add list of points to qdrant collection
    if not await client.collection_exists(item.collection_name):
        return Error(code=404, error="Collection does not exist")

    await client.upsert(
        collection_name = item.collection_name,
        points = [
            models.PointStruct(
                id = p.id,
                vector = p.vector,
                payload = p.payload or {},
            )
            for p in item.points
        ],
    )

    return Success()


#
# Request that Required Matching Fields
#
@router.post("/filter", response_model=ResponseModel)
async def query_by_payload(item: QueryByPayloadRequest):
    # search top point by filtering
    if not await client.collection_exists(item.collection_name):
        return Error(code = 404, error = "Collection does not exist")

    if item.match_type == MatchType.any:
        results, _ = await client.scroll(
            collection_name=item.collection_name,
            scroll_filter = models.Filter(
                should = build_matching_field(item.matching_payload),
            ),
            limit = item.limit,
            with_payload = True,
            with_vectors = False,
        )
        return Success(data = results)

    # By default use must
    results, _ = await client.scroll(
        collection_name = item.collection_name,
        scroll_filter = models.Filter(
            must = build_matching_field(item.matching_payload),
        ),
        limit=item.limit,
        with_payload=True,
        with_vectors=False,
    )

    return Success(data = results)

@router.delete("/delete_points", response_model=ResponseModel)
async def delete_points(item: DeletePointsRequest):
    # Delete Points based on either provided point list or matching field
    if not await client.collection_exists(item.collection_name):
        return Error(code=404, error="Collection does not exist")

    if item.point_ids:
        selector = models.PointIdsList(points=item.point_ids)
    elif item.matching_payload is not None:
        selector = models.FilterSelector(
            filter = models.Filter(
                must = build_matching_field(item.matching_payload),
            )
        )
    else:
        return Error(code=400, error="Must provide point_ids or both filter_field and filter_value")

    await client.delete(
        collection_name = item.collection_name,
        points_selector = selector,
    )

    return Success()


@router.post("/query_vector", response_model=ResponseModel)
async def vector_search(item: SearchRequest):
    # Similarity Search, allow matching field
    if not await client.collection_exists(item.collection_name):
        return Error(code=404, error="Collection does not exist")

    query_filter = None
    if item.matching_payload is not None:
        query_filter = models.Filter(
            must = build_matching_field(item.matching_payload),
        )

    results = await client.search(
        collection_name = item.collection_name,
        query_vector = item.query_vector,
        limit = item.limit,
        query_filter = query_filter,
        with_payload = True,
    )

    return Success(data=[r.model_dump() for r in results])

app = FastAPI()
app.include_router(router)

