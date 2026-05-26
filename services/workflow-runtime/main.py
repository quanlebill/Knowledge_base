from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from graph import build_graph
from config_loader import load_agent_config
from observability import get_langfuse_handler

app = FastAPI(title="workflow-runtime", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
