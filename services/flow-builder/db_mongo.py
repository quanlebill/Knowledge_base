import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def init_mongo():
    global _client, _db
    url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017/dataagent")
    db_name = url.split("/")[-1] or "dataagent"
    _client = AsyncIOMotorClient(url)
    _db = _client[db_name]
    logger.info("mongodb ready db=%s", db_name)


async def close_mongo():
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None


async def save_canvas(workflow_version_id: str, nodes: list, edges: list) -> None:
    await _db.flow_nodes.delete_many({"workflow_version_id": workflow_version_id})
    await _db.flow_edges.delete_many({"workflow_version_id": workflow_version_id})

    if nodes:
        await _db.flow_nodes.insert_many([
            {**n, "workflow_version_id": workflow_version_id} for n in nodes
        ])
    if edges:
        await _db.flow_edges.insert_many([
            {**e, "workflow_version_id": workflow_version_id} for e in edges
        ])


async def load_canvas(workflow_version_id: str) -> dict:
    nodes = await _db.flow_nodes.find(
        {"workflow_version_id": workflow_version_id}, {"_id": 0}
    ).to_list(None)
    edges = await _db.flow_edges.find(
        {"workflow_version_id": workflow_version_id}, {"_id": 0}
    ).to_list(None)
    return {"nodes": nodes, "edges": edges}
