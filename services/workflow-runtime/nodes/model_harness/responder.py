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
        max_chunks = cfg.get("context_max_chunks", 5)
        max_chars = cfg.get("context_max_chars", 4000)
        chunks = state["reranked_chunks"][:max_chunks]

        parts = []
        total_chars = 0
        for i, c in enumerate(chunks):
            source = c.get("source", c.get("id", "unknown"))
            score = c.get("score", c.get("rrf_score", ""))
            score_str = f" | score={score:.3f}" if isinstance(score, float) else ""
            header = f"[{i+1}] source={source}{score_str}"
            content = c["content"]
            if total_chars + len(content) > max_chars:
                content = content[:max_chars - total_chars]
            parts.append(f"{header}\n{content}")
            total_chars += len(content)
            if total_chars >= max_chars:
                break

        context = "\n\n---\n\n".join(parts)
        system_prompt = f"{system_prompt}\n\nContext:\n{context}"

    # whitelist role để tránh inject system message qua history
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in state.get("messages", [])
        if m.get("role") in ("user", "assistant")
    ]
    # tránh duplicate nếu query đã có trong message cuối
    if history and history[-1]["role"] == "user" and history[-1]["content"] == state["query"]:
        history = history[:-1]

    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": state["query"]},
    ]

    t0 = time.monotonic()
    # LiteLLM tự fallback nếu model không hỗ trợ stream, nhưng giữ config để debug hoặc tắt chủ động
    stream = cfg.get("responder_stream", True)
    response = litellm.completion(
        model=cfg.get("responder_model", "responder"),
        api_base=_LITELLM_BASE,
        api_key=_LITELLM_KEY,
        messages=messages,
        temperature=cfg.get("responder_temperature", 0.2),
        max_tokens=cfg.get("responder_max_tokens", 1000),
        stream=stream,
    )

    full_text = ""
    prompt_tokens = 0
    completion_tokens = 0

    if stream:
        for chunk in response:
            token = chunk.choices[0].delta.content or ""
            full_text += token
            print(token, end="", flush=True)
            if hasattr(chunk, "usage") and chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or prompt_tokens
                completion_tokens = chunk.usage.completion_tokens or completion_tokens
        print()
    else:
        full_text = response.choices[0].message.content or ""
        usage = response.usage or {}
        prompt_tokens = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", 0)
        completion_tokens = getattr(usage, "completion_tokens", None) or getattr(usage, "output_tokens", 0)

    latency_ms = int((time.monotonic() - t0) * 1000)
    logger.info("responder | latency=%dms prompt_tokens=%d completion_tokens=%d",
                latency_ms, prompt_tokens, completion_tokens)

    return {"response": full_text}
