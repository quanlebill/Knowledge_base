import re
import uuid
from neo4j import AsyncGraphDatabase
from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import Success, Error

from fastapi import APIRouter, FastAPI
from services.database_connector.Neo4j.API_model.api_model import *
from services.database_connector.Neo4j.API_model.enum_type import *

driver = AsyncGraphDatabase.driver(
    DBConfig.NEO4J_URI,
    auth=(DBConfig.NEO4J_USER, DBConfig.NEO4J_PASSWORD),
)

router = APIRouter(prefix='/neo4j')

def validate_node_name(value: str) -> str:
    # Only allow alphanumeric and underscore
    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', value):
        raise ValueError(f"Invalid identifier '{value}': only letters, digits and underscores allowed")
    return value


@router.post("/add_node", response_model=ResponseModel)
async def add_node(item: AddNodeRequest):
    try:
        label = validate_node_name(item.node.label)
    except ValueError as e:
        return Error(code=400, error=str(e))

    node_id = str(uuid.uuid4())
    props = {**item.node.properties, "id": node_id}
    if item.node.embedding:
        props["embedding"] = item.node.embedding

    async with driver.session() as session:
        result = await session.run(
            f"CREATE (n:`{label}` $props) RETURN n.id AS id",
            props=props,
        )
        record = await result.single()
    return Success(data={"id": record["id"]})


@router.post("/add_relationship", response_model=ResponseModel)
async def add_relationship(item: AddRelationshipRequest):
    # type is stored as a property on the unified RELATED_TO edge
    props = {**(item.relationship.properties or {}), "type": item.relationship.type}
    direction = item.relationship.direction

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
            from_id=item.from_node_id,
            to_id=item.to_node_id,
            props=props,
        )
        record = await result.single()

    if record is None:
        return Error(code=404, error="One or both nodes not found")
    return Success(data={"type": record["type"]})


@router.post("/expand", response_model=ResponseModel)
async def graph_expand(item: GraphExpandRequest):
    similarity_expr = (
        """
        CASE WHEN neighbour.embedding IS NOT NULL
             THEN vector.similarity.cosine(neighbour.embedding, $query_vector)
             ELSE 0.0 END
        """
        if item.query_vector
        else "0.0"
    )

    query = f"""
        MATCH (start {{id: $start_id}})-[*1..{item.max_hops}]-(neighbour)
        WHERE neighbour.id <> $start_id
        WITH DISTINCT neighbour, {similarity_expr} AS similarity
        ORDER BY similarity DESC
        LIMIT $max_neighbours
        RETURN neighbour{{.*}} AS node, similarity
    """

    async with driver.session() as session:
        result = await session.run(
            query,
            start_id=item.start_node_id,
            max_neighbours=item.max_neighbours,
            query_vector=item.query_vector or [],
        )
        records = await result.data()

    return Success(data=records)


app = FastAPI()
app.include_router(router)
