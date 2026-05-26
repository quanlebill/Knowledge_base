import os
import time
import logging
import litellm

from state import AgentState

logger = logging.getLogger(__name__)

_LITELLM_BASE = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
_LITELLM_KEY = os.environ.get("LITELLM_API_KEY", "sk-dev")


def planner_node(state: AgentState) -> dict:
    t0 = time.monotonic()

    response = litellm.completion(
        model="openai/planner",
        api_base=_LITELLM_BASE,
        api_key=_LITELLM_KEY,
        messages=[
            {"role": "system", "content": "Classify the query intent. Return JSON: {tool_calls: []}"},
            {"role": "user", "content": state["query"]},
        ],
        temperature=0,
        max_tokens=256,
    )

    latency_ms = int((time.monotonic() - t0) * 1000)
    usage = response.usage
    logger.info("planner | latency=%dms prompt_tokens=%d completion_tokens=%d",
                latency_ms, usage.prompt_tokens, usage.completion_tokens)

    return {"tool_calls": []}
