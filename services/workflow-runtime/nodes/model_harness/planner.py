import os
import time
import json
import logging
import litellm

from state import AgentState

logger = logging.getLogger(__name__)

_LITELLM_BASE = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
_LITELLM_KEY = os.environ.get("LITELLM_API_KEY", "sk-dev")

_SYSTEM = (
    "Analyze the query. If it requires external data or tools, return JSON: "
    "{\"tool_calls\": [{\"type\": \"kb_search\"}, {\"type\": \"mcp\", \"tool_name\": \"<name>\"}]}. "
    "If no tools needed, return {\"tool_calls\": []}. "
    "Return ONLY the JSON object, no explanation."
)


def planner_node(state: AgentState) -> dict:
    t0 = time.monotonic()

    response = litellm.completion(
        model="openai/planner",
        api_base=_LITELLM_BASE,
        api_key=_LITELLM_KEY,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": state["query"]},
        ],
        temperature=0,
        max_tokens=256,
    )

    latency_ms = int((time.monotonic() - t0) * 1000)
    usage = response.usage
    logger.info("planner | latency=%dms prompt_tokens=%d completion_tokens=%d",
                latency_ms, usage.prompt_tokens, usage.completion_tokens)

    raw = response.choices[0].message.content or ""
    try:
        parsed = json.loads(raw)
        tool_calls = parsed.get("tool_calls", [])
    except Exception:
        logger.warning("planner | failed to parse JSON response, using fallback. raw=%r", raw)
        tool_calls = []

    return {"tool_calls": tool_calls}
