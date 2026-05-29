import os
import json
import logging
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

try:
    import numpy as np
    _NUMPY = True
except ImportError:
    _NUMPY = False

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert


def _json_fallback(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, set):
        return list(obj)
    if _NUMPY:
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.integer,)):
            return int(obj)
    return repr(obj)


def _json_dumps(obj):
    return json.dumps(obj, default=_json_fallback)


_SENSITIVE_KEYS = frozenset({
    "api_key", "apikey", "api_secret", "secret", "secret_key",
    "token", "access_token", "refresh_token", "id_token",
    "password", "passwd", "pwd",
    "authorization", "auth",
    "email", "phone", "ssn", "national_id",
    "credit_card", "card_number",
})

_MAX_STR_LEN  = 2_000   # ký tự tối đa cho 1 string value
_MAX_LIST_LEN = 20      # phần tử tối đa cho list/array
_MAX_DICT_KEYS = 50     # key tối đa cho 1 dict


def _sanitize_trace(data: dict) -> dict:
    """Redact sensitive fields and limit size before persisting to agent_traces."""
    if not isinstance(data, dict):
        return data

    result = {}
    for k, v in list(data.items())[:_MAX_DICT_KEYS]:
        if k.lower() in _SENSITIVE_KEYS:
            result[k] = "[REDACTED]"
        elif isinstance(v, dict):
            result[k] = _sanitize_trace(v)
        elif isinstance(v, list):
            truncated = v[:_MAX_LIST_LEN]
            result[k] = [
                _sanitize_trace(i) if isinstance(i, dict) else i
                for i in truncated
            ]
            if len(v) > _MAX_LIST_LEN:
                result[k].append(f"... (+{len(v) - _MAX_LIST_LEN} items truncated)")
        elif isinstance(v, str) and len(v) > _MAX_STR_LEN:
            result[k] = v[:_MAX_STR_LEN] + f"... ({len(v) - _MAX_STR_LEN} chars truncated)"
        else:
            result[k] = v
    return result

from models import Conversation, Message, AgentTrace, Member

logger = logging.getLogger(__name__)

_engine = None
_session_factory = None

_DEV_TENANT_ID    = os.getenv("DEV_TENANT_ID",    "00000000-0000-0000-0000-000000000001")
_DEV_AGENT_VER_ID = os.getenv("DEV_AGENT_VER_ID", "00000000-0000-0000-0000-000000000040")

# Higher weight = higher privilege
_ROLE_WEIGHTS = {"admin": 3, "editor": 2, "viewer": 1}


async def init_db():
    global _engine, _session_factory
    url = os.environ.get("RUNTIME_DB_URL") or os.environ.get("DATABASE_URL")
    if not url:
        logger.warning("RUNTIME_DB_URL/DATABASE_URL not set — DB persistence disabled")
        return
    if "postgresql+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    _engine = create_async_engine(url, pool_size=2, max_overflow=8, json_serializer=_json_dumps)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    logger.info("db engine ready")


async def close_db():
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("db engine closed")


async def _has_role(
    session: AsyncSession,
    tenant_id: str,
    user_ref: str,
    min_role: str,
) -> bool:
    """Return True if user_ref is an active member of tenant_id with at least min_role."""
    if user_ref == "anonymous":
        return True  # dev bypass
    result = await session.execute(
        select(Member.tenant_role)
        .where(Member.tenant_id == UUID(tenant_id))
        .where(Member.user_id == user_ref)
        .where(Member.is_active.is_(True))
    )
    row = result.first()
    return bool(row) and _ROLE_WEIGHTS.get(row[0], 0) >= _ROLE_WEIGHTS.get(min_role, 0)


async def create_conversation(
    agent_version_id: str = _DEV_AGENT_VER_ID,
    user_ref: str = "anonymous",
    channel: str = "web",
    tenant_id: str = _DEV_TENANT_ID,
) -> Optional[str]:
    if not _session_factory:
        return None
    async with _session_factory() as session:
        if not await _has_role(session, tenant_id, user_ref, "viewer"):
            logger.warning("RBAC deny create_conversation: user=%s tenant=%s", user_ref, tenant_id)
            return None
        conv = Conversation(
            tenant_id=UUID(tenant_id),
            agent_version_id=UUID(agent_version_id),
            user_ref=user_ref,
            channel=channel,
        )
        session.add(conv)
        await session.commit()
        return str(conv.id)


async def save_message(
    conversation_id: str,
    role: str,
    content: str,
    tokens: int = 0,
    latency_ms: int = 0,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    if not _session_factory:
        return None
    async with _session_factory() as session:
        msg = Message(
            conversation_id=UUID(conversation_id),
            role=role,
            content={"text": content},
            tokens_used=tokens,
            latency_ms=latency_ms,
            metadata_=metadata or {},
        )
        session.add(msg)
        await session.commit()
        return str(msg.id)


async def save_trace(
    message_id: str,
    trace_index: int,
    tool_name: str,
    input: dict,
    output: dict,
    status: str = "success",
    latency_ms: int = 0,
):
    if not _session_factory:
        return
    async with _session_factory() as session:
        stmt = (
            pg_insert(AgentTrace)
            .values(
                message_id=UUID(message_id),
                trace_index=trace_index,
                tool_name=tool_name,
                input=_sanitize_trace(input),
                output=_sanitize_trace(output),
                status=status,
                latency_ms=latency_ms,
            )
            .on_conflict_do_nothing(index_elements=["message_id", "trace_index"])
        )
        await session.execute(stmt)
        await session.commit()
