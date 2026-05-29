import logging
from typing import List
from uuid import UUID

from sqlalchemy import select, func

from db import get_session
from models import AgentMemory, MemoryPolicy

logger = logging.getLogger(__name__)

_DEV_AGENT_ID  = "00000000-0000-0000-0000-000000000030"
_DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001"


async def retrieve_memories(
    tenant_id: str,
    agent_id: str,
    user_ref: str,
    query: str,
    limit: int = 5,
) -> List[dict]:
    session_ctx = get_session()
    if not session_ctx:
        return []
    try:
        async with session_ctx as session:
            q = (
                select(
                    AgentMemory.id,
                    AgentMemory.content,
                    AgentMemory.memory_type,
                    AgentMemory.scope,
                )
                .where(AgentMemory.tenant_id == UUID(tenant_id))
                .where(AgentMemory.agent_id == UUID(agent_id))
                .where(AgentMemory.deleted_at.is_(None))
                # TODO: thay bằng vector/embedding search khi LightRAG/Qdrant sẵn sàng
                .where(
                    func.to_tsvector("simple", AgentMemory.content).op("@@")(
                        func.plainto_tsquery("simple", query[:100])
                    )
                )
            )
            # scope=user thì lọc thêm theo user_ref, scope=global thì lấy tất cả
            if user_ref and user_ref != "anonymous":
                q = q.where(
                    (AgentMemory.scope == "global") |
                    ((AgentMemory.scope == "user") & (AgentMemory.user_ref == user_ref))
                )
            result = await session.execute(
                q.order_by(AgentMemory.importance.desc()).limit(limit)
            )
            memories = [row._asdict() for row in result]
            logger.info("memory | retrieved %d memories for agent=%s", len(memories), agent_id)
            return memories
    except Exception as e:
        logger.warning("memory | retrieve failed: %s", e)
        return []


async def apply_memory_policy(state: dict, agent_id: str, tenant_id: str) -> None:
    session_ctx = get_session()
    if not session_ctx:
        return
    try:
        async with session_ctx as session:
            result = await session.execute(
                select(MemoryPolicy.action_type)
                .where(MemoryPolicy.agent_id == UUID(agent_id))
                .where(MemoryPolicy.enabled.is_(True))
            )
            policies = result.fetchall()

            for (action,) in policies:
                if action == "add":
                    response = state.get("response", "").strip()
                    query    = state.get("query", "").strip()
                    if response:
                        memory = AgentMemory(
                            tenant_id=UUID(tenant_id),
                            agent_id=UUID(agent_id),
                            content=f"Q: {query}\nA: {response}",
                            memory_type="auto",
                            scope="global",
                        )
                        session.add(memory)
                        logger.info("memory | add saved for agent=%s", agent_id)
                # TODO: update, delete, summarize

            await session.commit()
    except Exception as e:
        logger.warning("memory | apply_policy failed: %s", e)
