NODE_REGISTRY = {
    "guardrail": {
        "display": "Guardrail",
        "category": "default",
        "locked": True,
        "schema": {},
    },
    "planner": {
        "display": "Planner",
        "category": "default",
        "locked": False,
        "schema": {
            "top_k_tools":          {"type": "number",   "default": 5},
            "similarity_threshold": {"type": "number",   "default": 0.7},
        },
    },
    "kb_search": {
        "display": "KB Search",
        "category": "default",
        "locked": False,
        "schema": {
            "kb_connection_id": {"type": "dropdown", "source": "/api/kb-connections"},
            "mode":             {"type": "dropdown", "options": ["naive", "local", "global", "hybrid"]},
            "top_k":            {"type": "number",   "default": 10},
        },
    },
    "mcp_tool": {
        "display": "MCP Tool",
        "category": "default",
        "locked": False,
        "schema": {
            "mcp_id":        {"type": "dropdown",    "source": "/api/mcp"},
            "allowed_tools": {"type": "multiselect", "source": "mcp.capabilities"},
        },
    },
    "rrf_ranking": {
        "display": "RRF Ranking",
        "category": "default",
        "locked": False,
        "schema": {
            "k":     {"type": "number", "default": 60},
            "top_n": {"type": "number", "default": 20},
        },
    },
    "reranker": {
        "display": "Reranker",
        "category": "default",
        "locked": False,
        "schema": {
            "top_n": {"type": "number", "default": 5},
        },
    },
    "reasoner": {
        "display": "Reasoner",
        "category": "default",
        "locked": False,
        "schema": {
            "model_id":         {"type": "dropdown", "source": "/api/llm-providers?type=chat"},
            "system_prompt_id": {"type": "dropdown", "source": "/api/system-prompts"},
            "temperature":      {"type": "slider",   "min": 0, "max": 2, "default": 0.2},
            "max_tokens":       {"type": "number",   "default": 1000},
        },
    },
    "human_approval": {
        "display": "Human Approval",
        "category": "optional",
        "locked": False,
        "schema": {
            "timeout_minutes": {"type": "number", "default": 30},
        },
    },
    "condition": {
        "display": "Condition",
        "category": "optional",
        "locked": False,
        "schema": {
            "expression": {"type": "text"},
            "branches":   {"type": "list"},
        },
    },
    "loop": {
        "display": "Loop",
        "category": "optional",
        "locked": False,
        "schema": {
            "max_iterations": {"type": "number", "default": 3},
        },
    },
    "notification": {
        "display": "Notification",
        "category": "optional",
        "locked": False,
        "schema": {
            "event_type":       {"type": "text"},
            "payload_template": {"type": "json"},
        },
    },
}
