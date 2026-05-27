import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

DEV_CONFIG = {
    "kb_endpoint": os.environ.get("KB_ENDPOINT", "http://localhost:8080"),
    "kb_mode": os.environ.get("KB_MODE", "hybrid"),
    "top_k": int(os.environ.get("KB_TOP_K", "10")),
    "max_depth": int(os.environ.get("KB_MAX_DEPTH", "3")),
    "reasoner_model_id": "reasoner",
    "system_prompt": os.environ.get("DEV_SYSTEM_PROMPT", "You are a helpful assistant."),
    "temperature": 0.2,
    "max_tokens": 1000,
    "reranker_top_n": 5,
    "memory_enabled": False,
    "mcp_endpoints": [],
    "guardrail_input_patterns": ["fuck", "kill", "bomb", "hack", "tấn công"],
    "guardrail_output_patterns": ["mật khẩu", "password", "secret", "token"],
    "guardrail_id": None,
    "agent_id": "00000000-0000-0000-0000-000000000030",
}


def load_agent_config(agent_id: str) -> dict:
    # TODO phase J: đọc từ PostgreSQL + MongoDB
    return DEV_CONFIG
