import re
import time
import logging

from state import AgentState

logger = logging.getLogger(__name__)


def _matches_any(text: str, patterns: list) -> tuple:
    for p in patterns:
        try:
            if re.search(p, text, re.IGNORECASE):
                return True, "Yêu cầu không được phép."
        except re.error:
            logger.warning("guardrail | invalid regex pattern skipped: %r", p)
    return False, ""


def guardrail_input_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    patterns = state["config"].get("guardrail_input_patterns", [])

    triggered, message = _matches_any(state["query"], patterns)
    latency_ms = int((time.monotonic() - t0) * 1000)
    logger.info("guardrail_input | latency=%dms triggered=%s", latency_ms, triggered)

    return {
        "guardrail_triggered": triggered,
        "guardrail_message": message,
    }


def guardrail_output_node(state: AgentState) -> dict:
    # Input guardrail already blocked — nothing to check
    if state.get("guardrail_triggered"):
        return {}

    patterns = state["config"].get("guardrail_output_patterns", [])
    if not patterns:
        return {}

    triggered, message = _matches_any(state.get("response", ""), patterns)
    if triggered:
        logger.info("guardrail_output | triggered, blocking response")
        return {
            "guardrail_triggered": True,
            "guardrail_message": message,
            "response": message,
        }
    return {}
