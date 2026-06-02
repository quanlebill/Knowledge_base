from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db_pg import init_db, close_db, get_pool, create_agent, list_agents, get_agent, create_workflow, list_workflows, publish_agent
from db_mongo import init_mongo, close_mongo, save_canvas, load_canvas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_DEV_TENANT_ID = os.environ.get("DEV_TENANT_ID", "00000000-0000-0000-0000-000000000001")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_mongo()
    yield
    await close_mongo()
    await close_db()


app = FastAPI(title="flow-builder", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateAgentRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class CreateWorkflowRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class CanvasPayload(BaseModel):
    nodes: list
    edges: list


class PublishRequest(BaseModel):
    workflow_id: str


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# ─── Agent endpoints ──────────────────────────────────────────────────────────

@app.post("/api/agents", status_code=201)
async def api_create_agent(
    body: CreateAgentRequest,
    x_tenant_id: str = Header(default=None),
):
    tenant_id = x_tenant_id or _DEV_TENANT_ID
    if not get_pool():
        raise HTTPException(503, "DB not available")
    try:
        result = await create_agent(body.name, body.description or "", tenant_id)
        return result
    except Exception as e:
        logger.exception("create_agent failed")
        raise HTTPException(500, str(e))


@app.get("/api/agents")
async def api_list_agents(x_tenant_id: str = Header(default=None)):
    tenant_id = x_tenant_id or _DEV_TENANT_ID
    if not get_pool():
        raise HTTPException(503, "DB not available")
    rows = await list_agents(tenant_id)
    return [_serialize(r) for r in rows]


@app.get("/api/agents/{agent_id}")
async def api_get_agent(agent_id: str):
    if not get_pool():
        raise HTTPException(503, "DB not available")
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    workflows = await list_workflows(agent_id)
    return {**_serialize(agent), "workflows": [_serialize(w) for w in workflows]}


# ─── Workflow endpoints ────────────────────────────────────────────────────────

@app.post("/api/agents/{agent_id}/workflows", status_code=201)
async def api_create_workflow(agent_id: str, body: CreateWorkflowRequest):
    if not get_pool():
        raise HTTPException(503, "DB not available")
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    try:
        result = await create_workflow(agent_id, body.name, body.description or "")
        return result
    except Exception as e:
        logger.exception("create_workflow failed")
        raise HTTPException(500, str(e))


@app.get("/api/agents/{agent_id}/workflows")
async def api_list_workflows(agent_id: str):
    if not get_pool():
        raise HTTPException(503, "DB not available")
    rows = await list_workflows(agent_id)
    return [_serialize(r) for r in rows]


# ─── Canvas endpoints ──────────────────────────────────────────────────────────

@app.post("/api/workflow-versions/{workflow_version_id}/canvas")
async def api_save_canvas(workflow_version_id: str, body: CanvasPayload):
    try:
        await save_canvas(workflow_version_id, body.nodes, body.edges)
        return {"saved": True, "workflow_version_id": workflow_version_id}
    except Exception as e:
        logger.exception("save_canvas failed")
        raise HTTPException(500, str(e))


@app.get("/api/workflow-versions/{workflow_version_id}/canvas")
async def api_load_canvas(workflow_version_id: str):
    try:
        return await load_canvas(workflow_version_id)
    except Exception as e:
        logger.exception("load_canvas failed")
        raise HTTPException(500, str(e))


# ─── Publish endpoint ──────────────────────────────────────────────────────────

@app.post("/api/agents/{agent_id}/publish")
async def api_publish_agent(agent_id: str, body: PublishRequest):
    if not get_pool():
        raise HTTPException(503, "DB not available")
    try:
        result = await publish_agent(agent_id, body.workflow_id)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("publish_agent failed")
        raise HTTPException(500, str(e))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize(row: dict) -> dict:
    import uuid
    from datetime import datetime
    out = {}
    for k, v in row.items():
        if isinstance(v, uuid.UUID):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out
