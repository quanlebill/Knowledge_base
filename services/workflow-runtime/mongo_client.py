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
    logger.info("mongo ready db=%s", db_name)


async def close_mongo():
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None


async def load_flow_nodes(workflow_version_id: str) -> list[dict]:
    if not _db or not workflow_version_id:
        return []
    try:
        nodes = await _db.flow_nodes.find(
            {"workflow_version_id": workflow_version_id}, {"_id": 0}
        ).to_list(None)
        return nodes
    except Exception as e:
        logger.warning("mongo load_flow_nodes failed: %s", e)
        return []
