import logging
from typing import List

from db import _pool

logger = logging.getLogger(__name__)

_DEV_AGENT_ID  = "00000000-0000-0000-0000-000000000030"
_DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001"


async def retrieve_memories(agent_id: str, query: str, limit: int = 5) -> List[dict]:
    if not _pool:
        return []
    try:
        rows = await _pool.fetch(
            """
            SELECT id, content, memory_type, scope, created_at
            FROM agent_memories
            WHERE agent_id = $1
              AND deleted_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
              AND content ILIKE $2
            ORDER BY importance DESC, created_at DESC
            LIMIT $3
            """,
            agent_id, f"%{query[:50]}%", limit,
        )
        memories = [dict(r) for r in rows]
        logger.info("memory | retrieved %d memories for agent=%s", len(memories), agent_id)
        return memories
    except Exception as e:
        logger.warning("memory | retrieve failed: %s", e)
        return []


async def apply_memory_policy(state: dict, agent_id: str, tenant_id: str) -> None:
    if not _pool:
        return
    try:
        policies = await _pool.fetch(
            """
            SELECT action_type, condition
            FROM memory_policy
            WHERE agent_id = $1 AND enabled = true
            """,
            agent_id,
        )
        for policy in policies:
            action = policy["action_type"]
            if action == "ADD":
                response = state.get("response", "").strip()
                query    = state.get("query", "").strip()
                if response:
                    content = f"Q: {query}\nA: {response}"
                    await _pool.execute(
                        """
                        INSERT INTO agent_memories
                          (tenant_id, agent_id, content, memory_type, scope)
                        VALUES ($1, $2, $3, 'auto', 'global')
                        """,
                        tenant_id, agent_id, content,
                    )
                    logger.info("memory | ADD saved for agent=%s", agent_id)
            # TODO: UPDATE, DELETE, SUMMARIZE
    except Exception as e:
        logger.warning("memory | apply_policy failed: %s", e)
