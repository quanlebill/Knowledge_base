import os
import json
import asyncpg
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None

_DEV_TENANT_ID    = "00000000-0000-0000-0000-000000000001"
_DEV_AGENT_VER_ID = "00000000-0000-0000-0000-000000000040"


async def init_db():
    global _pool
    url = os.environ.get("DATABASE_URL")
    if not url:
        logger.warning("DATABASE_URL not set — DB persistence disabled")
        return
    _pool = await asyncpg.create_pool(url, min_size=2, max_size=10)
    logger.info("db pool ready")


async def create_conversation(
    agent_version_id: str = _DEV_AGENT_VER_ID,
    user_ref: str = "anonymous",
    channel: str = "web",
) -> Optional[str]:
    if not _pool:
        return None
    row = await _pool.fetchrow(
        """INSERT INTO conversations (tenant_id, agent_version_id, user_ref, channel)
           VALUES ($1, $2, $3, $4) RETURNING id""",
        _DEV_TENANT_ID, agent_version_id, user_ref, channel,
    )
    return str(row["id"]) if row else None


async def save_message(
    conversation_id: str,
    role: str,
    content: str,
    tokens: int = 0,
    latency_ms: int = 0,
) -> Optional[str]:
    if not _pool:
        return None
    row = await _pool.fetchrow(
        """INSERT INTO messages (conversation_id, role, content, tokens_used, latency_ms)
           VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id""",
        conversation_id, role, json.dumps({"text": content}),
        tokens, latency_ms,
    )
    return str(row["id"]) if row else None


async def save_trace(
    message_id: str,
    trace_index: int,
    tool_name: str,
    input: dict,
    output: dict,
    status: str = "success",
    latency_ms: int = 0,
):
    if not _pool:
        return
    await _pool.execute(
        """INSERT INTO agent_traces
             (message_id, trace_index, tool_name, input, output, status, latency_ms)
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
           ON CONFLICT (message_id, trace_index) DO NOTHING""",
        message_id, trace_index, tool_name,
        json.dumps(input), json.dumps(output), status, latency_ms,
    )
