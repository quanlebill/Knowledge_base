from qdrant_client import models
import qdrant_client
from pydantic import ValidationError

from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import ResponseModel, Success, Error
from .input_schema.request import (
    CreateCollectionRequest,
    AddPointsRequest,
    UpdatePayloadRequest,
    QueryByPayloadRequest,
    DeletePointsRequest,
    SearchRequest,
)
from .input_schema.enums import DistanceMetric, MatchType
from .input_schema.base_struct import MatchingPayload

from typing import List


client = qdrant_client.AsyncQdrantClient(
    host=DBConfig.QDRANT_HOST,
    port=DBConfig.QDRANT_PORT,
    grpc_port=DBConfig.QDRANT_GRPC_PORT,
    check_compatibility=False,
)


def _build_matching_field(data: List[MatchingPayload]) -> list[models.FieldCondition]:
    matching_field = []
    for matching_entity in data:
        for value in matching_entity.values:
            matching_field.append(
                models.FieldCondition(
                    key=matching_entity.field,
                    match=models.MatchValue(value=value),
                )
            )
    return matching_field


async def delete_collection(collection_name: str) -> ResponseModel:
    if not await client.collection_exists(collection_name):
        return Success()
    await client.delete_collection(collection_name)
    return Success()


async def create_collection(item: dict) -> ResponseModel:
    try:
        validated = CreateCollectionRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if await client.collection_exists(validated.name):
        return Error(code=409, error="Collection already exists")

    if validated.distance_metric not in DistanceMetric:
        return Error(code=404, error="Distance metric does not exist")

    distance = models.Distance.COSINE
    if validated.distance_metric == DistanceMetric.Euclidean.value:
        distance = models.Distance.EUCLID
    elif validated.distance_metric == DistanceMetric.Dot.value:
        distance = models.Distance.DOT

    await client.create_collection(
        collection_name=validated.name,
        vectors_config=models.VectorParams(
            size=validated.vector_size,
            distance=distance,
        ),
    )
    return Success()


async def update_payload(item: dict) -> ResponseModel:
    try:
        validated = UpdatePayloadRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if not await client.collection_exists(validated.collection_name):
        return Error(code=404, error="Collection does not exist")

    await client.set_payload(
        collection_name=validated.collection_name,
        payload=validated.payload,
        points=validated.point_ids,
    )
    return Success()


async def add_points(item: dict) -> ResponseModel:
    try:
        validated = AddPointsRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if not await client.collection_exists(validated.collection_name):
        return Error(code=404, error="Collection does not exist")

    await client.upsert(
        collection_name=validated.collection_name,
        points=[
            models.PointStruct(
                id=p.id,
                vector=p.vector,
                payload=p.payload.model_dump(mode="json") if p.payload else {},
            )
            for p in validated.points
        ],
    )
    return Success()


async def query_by_payload(item: dict) -> ResponseModel:
    try:
        validated = QueryByPayloadRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if not await client.collection_exists(validated.collection_name):
        return Error(code=404, error="Collection does not exist")

    if validated.match_type == MatchType.any:
        results, _ = await client.scroll(
            collection_name=validated.collection_name,
            scroll_filter=models.Filter(
                should=_build_matching_field(validated.matching_payload),
            ),
            limit=validated.limit,
            with_payload=True,
            with_vectors=False,
        )
    else:
        results, _ = await client.scroll(
            collection_name=validated.collection_name,
            scroll_filter=models.Filter(
                must=_build_matching_field(validated.matching_payload),
            ),
            limit=validated.limit,
            with_payload=True,
            with_vectors=False,
        )

    return Success(data=results)


async def delete_points(item: dict) -> ResponseModel:
    try:
        validated = DeletePointsRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if not await client.collection_exists(validated.collection_name):
        return Error(code=404, error="Collection does not exist")

    if validated.point_ids:
        selector = models.PointIdsList(points=validated.point_ids)
    elif validated.matching_payload is not None:
        selector = models.FilterSelector(
            filter=models.Filter(
                must=_build_matching_field(validated.matching_payload),
            )
        )
    else:
        return Error(code=400, error="Must provide point_ids or matching_payload")

    await client.delete(
        collection_name=validated.collection_name,
        points_selector=selector,
    )
    return Success()


async def vector_search(item: dict) -> ResponseModel:
    try:
        validated = SearchRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    if not await client.collection_exists(validated.collection_name):
        return Error(code=404, error="Collection does not exist")

    query_filter = None
    if validated.matching_payload is not None:
        query_filter = models.Filter(
            must=_build_matching_field(validated.matching_payload),
        )

    results = await client.search(
        collection_name=validated.collection_name,
        query_vector=validated.query_vector,
        limit=validated.limit,
        query_filter=query_filter,
        with_payload=True,
    )
    return Success(data=[r.model_dump() for r in results])

