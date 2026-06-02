from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

import os
import time
import logging
import base64
from contextlib import asynccontextmanager
from typing import Optional, List

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from graph import build_graph

logger = logging.getLogger(__name__)
from config_loader import load_agent_config
from observability import get_langfuse_handler
from node_registry import NODE_REGISTRY
from db import init_db, close_db, create_conversation, save_message, save_trace, validate_agent_tenant
from memory_middleware import (
    retrieve_memories, apply_memory_policy,
    init_qdrant, close_qdrant,
    _DEV_AGENT_ID, _DEV_TENANT_ID,
)
from mongo_client import init_mongo, close_mongo

# Graph cache per agent_id — rebuild khi config thay đổi
_graph_cache: dict[str, object] = {}
_default_graph = build_graph()  # fallback khi DB không có published version


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_qdrant()
    await init_mongo()
    yield
    await close_mongo()
    await close_qdrant()
    await close_db()


app = FastAPI(title="workflow-runtime", version="0.1.0", lifespan=lifespan)

_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)


class Message(BaseModel):
    role: str
    content: str


class RunRequest(BaseModel):
    query: str
    agent_id: str
    conversation_id: Optional[str] = None
    messages: List[Message] = []


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/nodes/registry")
def get_node_registry():
    return NODE_REGISTRY


# --- Dropdown sources (mock data until Phase F DB is ready) ---

_LLM_PROVIDERS = [
    {"id": "llm-planner",      "name": "Claude Haiku",  "model_id": "planner",      "type": "chat", "is_default": False},
    {"id": "llm-responder", "name": "Claude Sonnet", "model_id": "responder", "type": "chat", "is_default": True},
]

_SYSTEM_PROMPTS = [
    {"id": "sp-default", "name": "Default", "tenant_id": "tenant-dev",
     "content": "You are a helpful assistant for GTEL platform."},
]


@app.get("/api/llm-providers")
def get_llm_providers(type: Optional[str] = None):
    providers = _LLM_PROVIDERS
    if type:
        providers = [p for p in providers if p["type"] == type]
    return providers


@app.get("/api/kb-connections")
def get_kb_connections(request: Request):
    tenant_id = request.headers.get("X-Tenant-ID", "tenant-dev")
    return []


@app.get("/api/system-prompts")
def get_system_prompts(request: Request):
    tenant_id = request.headers.get("X-Tenant-ID", "tenant-dev")
    return [p for p in _SYSTEM_PROMPTS if p["tenant_id"] == tenant_id]


@app.post("/api/conversations/run")
async def run_conversation(req: RunRequest, request: Request):
    cfg      = await load_agent_config(req.agent_id)
    agent_id = cfg.get("agent_id", _DEV_AGENT_ID)

    # Build hoặc lấy graph từ cache
    flow_nodes = cfg.get("flow_nodes") or []
    if flow_nodes:
        if req.agent_id not in _graph_cache:
            _graph_cache[req.agent_id] = build_graph(flow_nodes)
        _graph = _graph_cache[req.agent_id]
    else:
        _graph = _default_graph
    tenant_id = request.headers.get("X-Tenant-ID", _DEV_TENANT_ID)

    if not await validate_agent_tenant(agent_id, tenant_id):
        return JSONResponse(status_code=403, content={"detail": "Agent not found or access denied"})

    user_ref = request.headers.get("X-User-ID", "anonymous")

    # RETRIEVE memory trước khi build state
    memory_context = []
    if cfg.get("memory_enabled"):
        memory_context = await retrieve_memories(
            tenant_id=tenant_id,
            agent_id=agent_id,
            user_ref=user_ref,
            query=req.query,
        )
    conv_id = req.conversation_id or await create_conversation(
        agent_version_id=cfg.get("agent_version_id", None),
        user_ref=user_ref,
        channel=request.headers.get("X-Channel", "web"),
        tenant_id=tenant_id,
    )

    state = {
        "query": req.query,
        "messages": [m.model_dump() for m in req.messages],
        "memory_context": memory_context,
        "tool_calls": [],
        "kb_chunks": [],
        "mcp_results": [],
        "rrf_results": [],
        "reranked_chunks": [],
        "response": "",
        "guardrail_triggered": False,
        "guardrail_message": "",
        "guardrail_stage": None,
        "guardrail_reason": None,
        "config": cfg,
    }

    handler = get_langfuse_handler(
        run_name=f"conv-{conv_id or 'new'}",
        session_id=conv_id,
        user_id=user_ref,
        metadata={
            "agent_id":        agent_id,
            "tenant_id":       tenant_id,
            "responder_model": cfg.get("responder_model"),
            "planner_model":   cfg.get("planner_model"),
        },
    )
    callbacks = [handler] if handler else []

    # If output patterns are configured we must buffer the response before streaming,
    # because we can't un-send tokens that have already been sent to the client.
    has_output_guardrail = bool(cfg.get("guardrail_output_patterns"))

    async def event_stream():
        full_response: list[str] = []
        guardrail_triggered = False
        guardrail_msg = ""
        guardrail_stage = None
        guardrail_reason = None
        t0 = time.monotonic()
        try:
            async for event in _graph.astream_events(state, version="v2", config={"callbacks": callbacks}):
                kind = event["event"]
                node = event.get("metadata", {}).get("langgraph_node", "")

                # Guardrail detection — catch state updates from both guardrail nodes
                if kind == "on_chain_end" and node in ("guardrail_input", "guardrail_output"):
                    output = event["data"].get("output", {})
                    if isinstance(output, dict) and output.get("guardrail_triggered"):
                        guardrail_triggered = True
                        guardrail_msg    = output.get("guardrail_message", "")
                        guardrail_stage  = output.get("guardrail_stage")
                        guardrail_reason = output.get("guardrail_reason")

                # Real token-by-token streaming từ responder (không stream planner tokens)
                elif kind == "on_chat_model_stream" and node == "responder":
                    token = event["data"]["chunk"].content or ""
                    if token:
                        full_response.append(token)
                        if not has_output_guardrail:
                            yield f"data: {token}\n\n"

            # Decide what to send after graph finishes
            if guardrail_triggered:
                yield f"data: {guardrail_msg}\n\n"
            elif has_output_guardrail:
                combined = "".join(full_response)
                if combined:
                    yield f"data: {combined}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.exception("event_stream error: %s", e)
            yield "data: [ERROR] Đã xảy ra lỗi, vui lòng thử lại.\n\n"
        finally:
            latency = int((time.monotonic() - t0) * 1000)
            assistant_text = guardrail_msg if guardrail_triggered else "".join(full_response)
            if conv_id:
                await save_message(conv_id, "user", req.query)
                asst_msg_id = await save_message(
                    conv_id, "assistant", assistant_text, latency_ms=latency,
                    metadata={
                        "guardrail": {
                            "triggered": guardrail_triggered,
                            "stage":     guardrail_stage,
                            "reason":    guardrail_reason,
                        }
                    },
                )
                if asst_msg_id:
                    await save_trace(
                        message_id=asst_msg_id,
                        trace_index=0,
                        tool_name="responder",
                        input={"query": req.query},
                        output={"response": assistant_text, "guardrail_triggered": guardrail_triggered},
                        latency_ms=latency,
                    )
            if cfg.get("memory_enabled") and not guardrail_triggered:
                final_state = {**state, "response": assistant_text}
                await apply_memory_policy(final_state, agent_id, tenant_id, user_ref)

    response = StreamingResponse(event_stream(), media_type="text/event-stream")
    response.headers["X-Conversation-Id"] = conv_id or ""
    return response


@app.get("/api/traces/{conv_id}")
async def get_traces_by_conv(conv_id: str):
    """Proxy: lấy Langfuse observations theo session (conv_id) rồi trả về frontend."""
    public_key = os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret_key  = os.environ.get("LANGFUSE_SECRET_KEY")
    host        = os.environ.get("LANGFUSE_HOST", "http://localhost:3001")

    if not public_key or not secret_key:
        return JSONResponse(status_code=503, content={"detail": "Langfuse not configured"})

    token        = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    auth_headers = {"Authorization": f"Basic {token}"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{host}/api/public/traces",
                params={"sessionId": conv_id},
                headers=auth_headers,
            )
            r.raise_for_status()
            traces = r.json().get("data", [])

            if not traces:
                return {"observations": []}

            trace_id = traces[0]["id"]
            r2 = await client.get(
                f"{host}/api/public/observations",
                params={"traceId": trace_id},
                headers=auth_headers,
            )
            r2.raise_for_status()
            return {"observations": r2.json().get("data", [])}

    except httpx.HTTPStatusError as e:
        logger.error("langfuse proxy HTTP error: %s", e.response.status_code)
        return JSONResponse(status_code=502, content={"detail": f"Langfuse HTTP {e.response.status_code}"})
    except Exception as e:
        logger.exception("langfuse proxy error: %s", e)
        return JSONResponse(status_code=502, content={"detail": "Langfuse unavailable"})
