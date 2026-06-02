import os
import json
import logging
import asyncpg
from typing import Optional

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None

_DEV_TENANT_ID          = os.environ.get("DEV_TENANT_ID",          "00000000-0000-0000-0000-000000000001")
_DEV_RESPONDER_MODEL_ID = os.environ.get("DEV_RESPONDER_MODEL_ID", "00000000-0000-0000-0000-000000000011")


async def init_db():
    global _pool
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        logger.warning("DATABASE_URL not set")
        return
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    _pool = await asyncpg.create_pool(url, min_size=1, max_size=5)
    logger.info("db pool ready")


async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> Optional[asyncpg.Pool]:
    return _pool


async def create_agent(name: str, description: str, tenant_id: str) -> dict:
    async with _pool.acquire() as conn:
        async with conn.transaction():
            agent = await conn.fetchrow(
                """
                INSERT INTO agents (tenant_id, name, description)
                VALUES ($1::uuid, $2, $3)
                RETURNING id, name, description, created_at
                """,
                tenant_id, name, description,
            )
            agent_id = str(agent["id"])

            workflow = await conn.fetchrow(
                """
                INSERT INTO workflows (agent_id, name)
                VALUES ($1::uuid, 'Default Workflow')
                RETURNING id
                """,
                agent_id,
            )
            workflow_id = str(workflow["id"])

            wv = await conn.fetchrow(
                """
                INSERT INTO workflow_versions (workflow_id, version, status)
                VALUES ($1::uuid, 1, 'draft')
                RETURNING id
                """,
                workflow_id,
            )
            wv_id = str(wv["id"])

            av = await conn.fetchrow(
                """
                INSERT INTO agent_versions
                  (agent_id, version, status, workflow_version_id, responder_model_id)
                VALUES ($1::uuid, 1, 'draft', $2::uuid, $3::uuid)
                RETURNING id
                """,
                agent_id, wv_id, _DEV_RESPONDER_MODEL_ID,
            )
            av_id = str(av["id"])

            await conn.execute(
                "UPDATE agents SET draft_version_id = $1::uuid WHERE id = $2::uuid",
                av_id, agent_id,
            )

    return {
        "agent_id": agent_id,
        "workflow_id": workflow_id,
        "workflow_version_id": wv_id,
        "agent_version_id": av_id,
    }


async def list_agents(tenant_id: str) -> list[dict]:
    rows = await _pool.fetch(
        """
        SELECT id, name, description, published_version_id, draft_version_id, created_at
        FROM agents
        WHERE tenant_id = $1::uuid AND deleted_at IS NULL
        ORDER BY created_at DESC
        """,
        tenant_id,
    )
    return [dict(r) for r in rows]


async def get_agent(agent_id: str) -> Optional[dict]:
    row = await _pool.fetchrow(
        """
        SELECT id, name, description, published_version_id, draft_version_id,
               tenant_id, created_at, updated_at
        FROM agents
        WHERE id = $1::uuid AND deleted_at IS NULL
        """,
        agent_id,
    )
    return dict(row) if row else None


async def create_workflow(agent_id: str, name: str, description: str) -> dict:
    async with _pool.acquire() as conn:
        async with conn.transaction():
            wf = await conn.fetchrow(
                """
                INSERT INTO workflows (agent_id, name, description)
                VALUES ($1::uuid, $2, $3)
                RETURNING id
                """,
                agent_id, name, description,
            )
            workflow_id = str(wf["id"])

            wv = await conn.fetchrow(
                """
                INSERT INTO workflow_versions (workflow_id, version, status)
                VALUES ($1::uuid, 1, 'draft')
                RETURNING id
                """,
                workflow_id,
            )
            wv_id = str(wv["id"])

    return {"workflow_id": workflow_id, "workflow_version_id": wv_id}


async def list_workflows(agent_id: str) -> list[dict]:
    rows = await _pool.fetch(
        """
        SELECT
            w.id, w.name, w.description, w.created_at,
            (SELECT id FROM workflow_versions
             WHERE workflow_id = w.id AND status = 'draft'
             ORDER BY version DESC LIMIT 1) AS draft_version_id,
            (SELECT id FROM workflow_versions
             WHERE workflow_id = w.id AND status = 'published'
             ORDER BY version DESC LIMIT 1) AS published_version_id
        FROM workflows w
        WHERE w.agent_id = $1::uuid AND w.is_active = true
        ORDER BY w.created_at DESC
        """,
        agent_id,
    )
    return [dict(r) for r in rows]


async def publish_agent(agent_id: str, workflow_id: str) -> dict:
    async with _pool.acquire() as conn:
        async with conn.transaction():
            # Validate workflow belongs to agent
            wf = await conn.fetchrow(
                "SELECT id FROM workflows WHERE id = $1::uuid AND agent_id = $2::uuid",
                workflow_id, agent_id,
            )
            if not wf:
                raise ValueError("workflow_id does not belong to agent_id")

            # Get draft workflow_version
            wv = await conn.fetchrow(
                """
                SELECT id, version FROM workflow_versions
                WHERE workflow_id = $1::uuid AND status = 'draft'
                ORDER BY version DESC LIMIT 1
                """,
                workflow_id,
            )
            if not wv:
                raise ValueError("No draft workflow_version found")
            wv_id = str(wv["id"])

            # Publish workflow_version
            await conn.execute(
                """
                UPDATE workflow_versions
                SET status = 'published', published_at = now()
                WHERE id = $1::uuid
                """,
                wv_id,
            )

            # Get draft agent_version
            av_draft = await conn.fetchrow(
                """
                SELECT * FROM agent_versions
                WHERE agent_id = $1::uuid AND status = 'draft'
                ORDER BY version DESC LIMIT 1
                """,
                agent_id,
            )

            new_version = (av_draft["version"] + 1) if av_draft else 1
            responder_model_id = str(av_draft["responder_model_id"]) if av_draft and av_draft["responder_model_id"] else _DEV_RESPONDER_MODEL_ID
            system_prompt_id   = str(av_draft["system_prompt_id"]) if av_draft and av_draft["system_prompt_id"] else None
            guardrail_id       = str(av_draft["guardrail_id"]) if av_draft and av_draft["guardrail_id"] else None
            memory_enabled     = av_draft["memory_enabled"] if av_draft else False
            def _to_dict(v):
                if not v: return {}
                return json.loads(v) if isinstance(v, str) else dict(v)
            llm_config       = _to_dict(av_draft["llm_config"])
            retrieval_config = _to_dict(av_draft["retrieval_config"])

            new_av = await conn.fetchrow(
                """
                INSERT INTO agent_versions
                  (agent_id, version, status, workflow_version_id, responder_model_id,
                   system_prompt_id, guardrail_id, memory_enabled, llm_config, retrieval_config)
                VALUES ($1::uuid, $2, 'published', $3::uuid, $4::uuid,
                        $5::uuid, $6::uuid, $7, $8::jsonb, $9::jsonb)
                RETURNING id
                """,
                agent_id, new_version, wv_id, responder_model_id,
                system_prompt_id, guardrail_id, memory_enabled,
                json.dumps(llm_config) if llm_config else None,
                json.dumps(retrieval_config) if retrieval_config else None,
            )
            new_av_id = str(new_av["id"])

            await conn.execute(
                "UPDATE agents SET published_version_id = $1::uuid WHERE id = $2::uuid",
                new_av_id, agent_id,
            )

    return {
        "agent_id": agent_id,
        "agent_version_id": new_av_id,
        "workflow_version_id": wv_id,
    }
