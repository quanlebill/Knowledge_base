import re
import uuid
from pydantic import ValidationError

from neo4j import AsyncGraphDatabase

from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import ResponseModel, Success, Error
from input_schema.request import AddNodeRequest, AddRelationshipRequest, GraphExpandRequest
from input_schema.enums import RelationshipDirection


driver = AsyncGraphDatabase.driver(
    DBConfig.NEO4J_URI,
    auth=(DBConfig.NEO4J_USER, DBConfig.NEO4J_PASSWORD),
)


def _validate_node_name(value: str) -> str:
    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', value):
        raise ValueError(f"Invalid identifier '{value}': only letters, digits and underscores allowed")
    return value


async def add_node(item: dict) -> ResponseModel:
    try:
        validated = AddNodeRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    try:
        label = _validate_node_name(validated.node.label)
    except ValueError as e:
        return Error(code=400, error=str(e))

    node_id = str(uuid.uuid4())
    props = {**validated.node.properties.model_dump(), "id": node_id}
    if validated.node.embedding:
        props["embedding"] = validated.node.embedding

    async with driver.session() as session:
        result = await session.run(
            f"CREATE (n:`{label}` $props) RETURN n.id AS id",
            props=props,
        )
        record = await result.single()
    return Success(data={"id": record["id"]})


async def add_relationship(item: dict) -> ResponseModel:
    try:
        validated = AddRelationshipRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    props = {**(validated.relationship.properties or {}), "type": validated.relationship.type}
    direction = validated.relationship.direction

    if direction == RelationshipDirection.OUTGOING.value:
        pattern = "(a)-[r:RELATED_TO $props]->(b)"
    elif direction == RelationshipDirection.INCOMING.value:
        pattern = "(a)<-[r:RELATED_TO $props]-(b)"
    else:
        pattern = "(a)-[r:RELATED_TO $props]-(b)"

    async with driver.session() as session:
        result = await session.run(
            f"""
            MATCH (a {{id: $from_id}}), (b {{id: $to_id}})
            CREATE {pattern}
            RETURN r.type AS type
            """,
            from_id=validated.from_node_id,
            to_id=validated.to_node_id,
            props=props,
        )
        record = await result.single()

    if record is None:
        return Error(code=404, error="One or both nodes not found")
    return Success(data={"type": record["type"]})


async def graph_expand(item: dict) -> ResponseModel:
    try:
        validated = GraphExpandRequest.model_validate(item)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    similarity_expr = (
        """
        CASE WHEN neighbour.embedding IS NOT NULL
             THEN vector.similarity.cosine(neighbour.embedding, $query_vector)
             ELSE 0.0 END
        """
        if validated.query_vector
        else "0.0"
    )

    query = f"""
        MATCH (start {{id: $start_id}})-[*1..{validated.max_hops}]-(neighbour)
        WHERE neighbour.id <> $start_id
        WITH DISTINCT neighbour, {similarity_expr} AS similarity
        ORDER BY similarity DESC
        LIMIT $max_neighbours
        RETURN neighbour{{.*}} AS node, similarity
    """

    async with driver.session() as session:
        result = await session.run(
            query,
            start_id=validated.start_node_id,
            max_neighbours=validated.max_neighbours,
            query_vector=validated.query_vector or [],
        )
        records = await result.data()

    return Success(data=records)
