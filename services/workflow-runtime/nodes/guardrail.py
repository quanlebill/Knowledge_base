import re
import json
import os
import time
import logging
import litellm

from state import AgentState

logger = logging.getLogger(__name__)

_LITELLM_BASE = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
_LITELLM_KEY = os.environ.get("LITELLM_API_KEY", "sk-dev")

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
_GUARDRAIL_SYSTEM = open(os.path.join(_PROMPTS_DIR, "guardrail_system.txt")).read()


def _regex_check(text: str, patterns: list) -> tuple[bool, str]:
    for p in patterns:
        try:
            if re.search(p, text, re.IGNORECASE):
                return True, "Yêu cầu không được phép."
        except re.error:
            logger.warning("guardrail | invalid regex pattern skipped: %r", p)
    return False, ""


def _llm_check(text: str, check_type: str, cfg: dict) -> tuple[bool, str]:
    allowed_topics = cfg.get("guardrail_allowed_topics", [])
    topics_block = ""
    if allowed_topics:
        topics_block = "\n\nCHỦ ĐỀ ĐƯỢC PHÉP:\n" + "\n".join(f"- {t}" for t in allowed_topics)

    system_prompt = _GUARDRAIL_SYSTEM + topics_block
    user_content = f"CHECK_TYPE: {check_type}\nCONTENT: {text}"

    try:
        response = litellm.completion(
            model=cfg.get("guardrail_model", "guardrail"),
            api_base=_LITELLM_BASE,
            api_key=_LITELLM_KEY,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            max_tokens=cfg.get("guardrail_max_tokens", 64),
            response_format={"type": "json_object"},
            timeout=cfg.get("guardrail_timeout", 5),
        )
        raw = response.choices[0].message.content or ""
        result = json.loads(raw)
        triggered = bool(result.get("triggered", False))
        reason = result.get("reason", "") or "Yêu cầu không được phép."
        return triggered, reason
    except Exception as e:
        logger.warning("guardrail | LLM check failed, defaulting to pass. error=%s", e)
        return False, ""


def guardrail_input_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    cfg = state.get("config", {})

    patterns = cfg.get("guardrail_input_patterns", [])
    triggered, message = _regex_check(state["query"], patterns)

    if not triggered and cfg.get("guardrail_llm_enabled", True):
        triggered, message = _llm_check(state["query"], "input", cfg)

    latency_ms = int((time.monotonic() - t0) * 1000)
    logger.info("guardrail_input | latency=%dms triggered=%s", latency_ms, triggered)

    return {
        "guardrail_triggered": triggered,
        "guardrail_message": message,
    }


def guardrail_output_node(state: AgentState) -> dict:
    if state.get("guardrail_triggered"):
        return {}

    cfg = state.get("config", {})

    patterns = cfg.get("guardrail_output_patterns", [])
    triggered, message = _regex_check(state.get("response", ""), patterns)

    if not triggered and cfg.get("guardrail_llm_enabled", True):
        triggered, message = _llm_check(state.get("response", ""), "output", cfg)

    if triggered:
        logger.info("guardrail_output | triggered, blocking response")
        return {
            "guardrail_triggered": True,
            "guardrail_message": message,
            "response": message,
        }
    return {}
