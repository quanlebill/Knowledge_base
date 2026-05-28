import os
import time
import logging
import litellm

from state import AgentState

logger = logging.getLogger(__name__)

_LITELLM_BASE = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
_LITELLM_KEY = os.environ.get("LITELLM_API_KEY", "sk-dev")


def responder_node(state: AgentState) -> dict:
    cfg = state["config"]
    system_prompt = cfg["system_prompt"]

    if state.get("reranked_chunks"):
        context = "\n\n".join(c["content"] for c in state["reranked_chunks"])
        system_prompt = f"{system_prompt}\n\nContext:\n{context}"

    messages = [
        {"role": "system", "content": system_prompt},
        *state.get("messages", []),
        {"role": "user", "content": state["query"]},
    ]

    t0 = time.monotonic()
    response = litellm.completion(
        model="openai/responder",
        api_base=_LITELLM_BASE,
        api_key=_LITELLM_KEY,
        messages=messages,
        temperature=cfg.get("temperature", 0.2),
        max_tokens=cfg.get("max_tokens", 1000),
        stream=True,
    )

    full_text = ""
    prompt_tokens = 0
    completion_tokens = 0

    for chunk in response:
        token = chunk.choices[0].delta.content or ""
        full_text += token
        print(token, end="", flush=True)
        if hasattr(chunk, "usage") and chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or prompt_tokens
            completion_tokens = chunk.usage.completion_tokens or completion_tokens

    print()
    latency_ms = int((time.monotonic() - t0) * 1000)
    logger.info("responder | latency=%dms prompt_tokens=%d completion_tokens=%d",
                latency_ms, prompt_tokens, completion_tokens)

    return {"response": full_text}
