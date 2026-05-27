from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from graph import build_graph
from config_loader import load_agent_config
from observability import get_langfuse_handler
from node_registry import NODE_REGISTRY

app = FastAPI(title="workflow-runtime", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph = build_graph()


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
async def run_conversation(req: RunRequest):
    state = {
        "query": req.query,
        "messages": [m.model_dump() for m in req.messages],
        "tool_calls": [],
        "kb_chunks": [],
        "mcp_results": [],
        "rrf_results": [],
        "reranked_chunks": [],
        "response": "",
        "config": load_agent_config(req.agent_id),
    }

    handler = get_langfuse_handler(run_name=f"conv-{req.conversation_id or 'new'}")
    callbacks = [handler] if handler else []

    async def event_stream():
        try:
            async for chunk in _graph.astream(state, config={"callbacks": callbacks}):
                if "reasoner" in chunk:
                    response = chunk["reasoner"].get("response", "")
                    if response:
                        yield f"data: {response}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
