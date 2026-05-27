from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from graph import build_graph
from config_loader import load_agent_config
from observability import get_langfuse_handler
from node_registry import NODE_REGISTRY
from db import init_db, create_conversation, save_message, save_trace
from memory_middleware import retrieve_memories, apply_memory_policy, _DEV_AGENT_ID, _DEV_TENANT_ID

app = FastAPI(title="workflow-runtime", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph = build_graph()


@app.on_event("startup")
async def startup():
    await init_db()


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
    {"id": "llm-planner",  "name": "Claude Haiku",  "model_id": "planner",  "type": "chat", "is_default": False},
    {"id": "llm-reasoner", "name": "Claude Sonnet", "model_id": "reasoner", "type": "chat", "is_default": True},
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
    cfg      = load_agent_config(req.agent_id)
    agent_id = cfg.get("agent_id", _DEV_AGENT_ID)
    tenant_id = request.headers.get("X-Tenant-ID", _DEV_TENANT_ID)

    # RETRIEVE memory trước khi build state
    memory_context = []
    if cfg.get("memory_enabled"):
        memory_context = await retrieve_memories(agent_id, req.query)

    conv_id = req.conversation_id or await create_conversation()

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
        "config": cfg,
    }

    handler = get_langfuse_handler(run_name=f"conv-{conv_id or 'new'}")
    callbacks = [handler] if handler else []

    # If output patterns are configured we must buffer the response before streaming,
    # because we can't un-send tokens that have already been sent to the client.
    has_output_guardrail = bool(cfg.get("guardrail_output_patterns"))

    async def event_stream():
        full_response: list[str] = []
        guardrail_triggered = False
        guardrail_msg = ""
        t0 = time.monotonic()
        try:
            async for chunk in _graph.astream(state, config={"callbacks": callbacks}):
                if "guardrail_output" in chunk:
                    g = chunk["guardrail_output"]
                    guardrail_triggered = g.get("guardrail_triggered", False)
                    guardrail_msg = g.get("guardrail_message", "")

                if "reasoner" in chunk:
                    token = chunk["reasoner"].get("response", "")
                    if token:
                        full_response.append(token)
                        # Stream real-time only when output guardrail is not active
                        if not has_output_guardrail:
                            yield f"data: {token}\n\n"

            # Decide what to send after graph finishes
            if guardrail_triggered:
                yield f"data: {guardrail_msg}\n\n"
            elif has_output_guardrail:
                # Output guardrail checked and passed — send buffered response now
                combined = "".join(full_response)
                if combined:
                    yield f"data: {combined}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
        finally:
            latency = int((time.monotonic() - t0) * 1000)
            assistant_text = guardrail_msg if guardrail_triggered else "".join(full_response)
            if conv_id:
                await save_message(conv_id, "user", req.query)
                asst_msg_id = await save_message(
                    conv_id, "assistant", assistant_text, latency_ms=latency
                )
                if asst_msg_id:
                    await save_trace(
                        message_id=asst_msg_id,
                        trace_index=0,
                        tool_name="reasoner",
                        input={"query": req.query},
                        output={"response": assistant_text, "guardrail_triggered": guardrail_triggered},
                        latency_ms=latency,
                    )
            if cfg.get("memory_enabled") and not guardrail_triggered:
                final_state = {**state, "response": assistant_text}
                await apply_memory_policy(final_state, agent_id, tenant_id)

    response = StreamingResponse(event_stream(), media_type="text/event-stream")
    response.headers["X-Conversation-Id"] = conv_id or ""
    return response
