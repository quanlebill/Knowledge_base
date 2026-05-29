import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

DEV_CONFIG = {
    "kb_endpoint": os.environ.get("KB_ENDPOINT", "http://localhost:8080"),
    "kb_mode": os.environ.get("KB_MODE", "hybrid"),
    "top_k": int(os.environ.get("KB_TOP_K", "10")),
    "max_depth": int(os.environ.get("KB_MAX_DEPTH", "3")),
    "planner_model": "planner",
    "planner_temperature": 0,
    "planner_max_tokens": 256,
    "planner_response_format": {"type": "json_object"},
    "planner_timeout": 10,
    "planner_num_retries": 2,
    "responder_model": "responder",
    "responder_temperature": 0.2,
    "responder_max_tokens": 1000,
    "responder_stream": True,
    "system_prompt": os.environ.get("DEV_SYSTEM_PROMPT", "You are a helpful assistant."),
    "rrf_top_n": 20,
    "reranker_model": "reranker",
    "reranker_top_n": 5,
    "context_max_chunks": 5,
    "context_max_chars": 4000,
    "memory_enabled": False,
    "mcp_endpoints": [],
    "guardrail_input_patterns": [
        {"id": "ip1", "pattern": "fuck"},
        {"id": "ip2", "pattern": "kill"},
        {"id": "ip3", "pattern": "bomb"},
        {"id": "ip4", "pattern": "hack"},
        {"id": "ip5", "pattern": "tấn công"},
    ],
    "guardrail_output_patterns": [
        {"id": "op1", "pattern": "mật khẩu"},
        {"id": "op2", "pattern": "password"},
        {"id": "op3", "pattern": "secret"},
        {"id": "op4", "pattern": "token"},
    ],
    "guardrail_llm_enabled": True,
    "guardrail_model": "guardrail",
    "guardrail_max_tokens": 64,
    "guardrail_timeout": 5,
    "guardrail_allowed_topics": [],
    "guardrail_id": None,
    "agent_id": "00000000-0000-0000-0000-000000000030",
}


def load_agent_config(agent_id: str) -> dict:
    # TODO phase J: đọc từ PostgreSQL + MongoDB
    return DEV_CONFIG
