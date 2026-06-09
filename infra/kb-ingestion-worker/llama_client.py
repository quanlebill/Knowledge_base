"""
Thin async client for the llama server's Ollama-compatible /api/chat endpoint.

Bypasses LiteLLM entirely so we control the exact payload fields
(format, grammar_gbnf, options.num_predict, temperature, etc.) without marshaling surprises.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

import config as cfg

log = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 300.0  # Increased from 120s to 300s for CPU inference

# ── GBNF grammars ──────────────────────────────────────────────────────────────
#
# Rules must be single-line.
# llama_cpp GBNF identifiers: [a-zA-Z0-9-]+ (hyphens OK, NO underscores).
#
# Stage 1: extract summary, entities (with descriptions), intents — no relationships.
# Entities are objects {name, description} so the description can be embedded
# and stored on the Neo4j entity node for neighbour ranking at query time.
ENTITY_INTENT_GBNF = "\n".join([
    r'root    ::= "{" ws sum-kv "," ws ents-kv "," ws ints-kv ws "}" ws',
    r'sum-kv  ::= "\"summary\""  ws ":" ws strval',
    r'ents-kv ::= "\"entities\"" ws ":" ws entarr',
    r'ints-kv ::= "\"intents\""  ws ":" ws strarr',
    r'entarr  ::= "[" ws "]" | "[" ws entobj (ws "," ws entobj)* ws "]"',
    r'entobj  ::= "{" ws "\"name\"" ws ":" ws strval ws "," ws "\"description\"" ws ":" ws strval ws "}"',
    r'strarr  ::= "[" ws "]" | "[" ws strval (ws "," ws strval)* ws "]"',
    r'strval  ::= "\"" strchar* "\""',
    r'strchar ::= [^"\\] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])',
    r'ws      ::= ([ \t\n\r] ws)?',
])

# Stage 2: extract relationships — the model receives the entity list from
# stage 1 so it can ONLY connect entities it was explicitly given.
RELATIONSHIP_GBNF = "\n".join([
    r'root    ::= "{" ws rels-kv ws "}" ws',
    r'rels-kv ::= "\"relationships\"" ws ":" ws relarr',
    r'relarr  ::= "[" ws "]" | "[" ws relobj (ws "," ws relobj)* ws "]"',
    r'relobj  ::= "{" ws "\"from\"" ws ":" ws strval ws "," ws "\"to\"" ws ":" ws strval ws "," ws "\"type\"" ws ":" ws strval ws "}"',
    r'strval  ::= "\"" strchar* "\""',
    r'strchar ::= [^"\\] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])',
    r'ws      ::= ([ \t\n\r] ws)?',
])

# Legacy combined grammar kept for reference; no longer used by gold.py.
EXTRACT_GBNF = "\n".join([
    r'root    ::= "{" ws sum-kv "," ws ents-kv "," ws rels-kv "," ws ints-kv ws "}" ws',
    r'sum-kv  ::= "\"summary\""       ws ":" ws strval',
    r'ents-kv ::= "\"entities\""      ws ":" ws strarr',
    r'rels-kv ::= "\"relationships\"" ws ":" ws relarr',
    r'ints-kv ::= "\"intents\""       ws ":" ws strarr',
    r'strarr  ::= "[" ws "]" | "[" ws strval (ws "," ws strval)* ws "]"',
    r'relarr  ::= "[" ws "]" | "[" ws relobj (ws "," ws relobj)* ws "]"',
    r'relobj  ::= "{" ws "\"from\"" ws ":" ws strval ws "," ws "\"to\"" ws ":" ws strval ws "," ws "\"type\"" ws ":" ws strval ws "}"',
    r'strval  ::= "\"" strchar* "\""',
    r'strchar ::= [^"\\] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])',
    r'ws      ::= ([ \t\n\r] ws)?',
])


async def chat_plain(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.3,
    timeout: float = _DEFAULT_TIMEOUT,
) -> str:
    """Send a chat request and return the raw assistant text (no JSON mode).

    Use this when the response should be free-form text rather than structured JSON
    (e.g. the conflict-merge handler which generates a merged prose chunk).
    """
    payload: dict[str, Any] = {
        "model":    "llama3",
        "messages": messages,
        "stream":   False,
        "options": {
            "num_predict": max_tokens,
            "temperature": temperature,
        },
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{cfg.LLAMA_BASE_URL}/api/chat",
            json=payload,
        )
        resp.raise_for_status()

    data = resp.json()
    content: str = (data.get("message") or {}).get("content") or ""
    log.debug("llama_client.chat_plain raw (first 200): %r", content[:200])
    if not content:
        raise RuntimeError("llama server returned empty content")
    return content


async def chat_json(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 512,
    temperature: float = 0.1,
    timeout: float = _DEFAULT_TIMEOUT,
    grammar_gbnf: str = "",
) -> str:
    """Send a chat request to the llama server and return the assistant content string.

    Passes format='json' so the model's grammar-constrained JSON mode is active.
    When grammar_gbnf is provided it is forwarded to the server for schema-constrained
    generation (prevents the model from generating off-schema structures that truncate).
    Raises httpx.HTTPStatusError on non-2xx, RuntimeError if content is empty.
    """
    payload: dict[str, Any] = {
        "model":    "llama3",
        "messages": messages,
        "format":   "json",
        "stream":   False,
        "options": {
            "num_predict":   max_tokens,
            "temperature":   temperature,
        },
    }
    if grammar_gbnf:
        payload["grammar_gbnf"] = grammar_gbnf

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{cfg.LLAMA_BASE_URL}/api/chat",
            json=payload,
        )
        resp.raise_for_status()

    data = resp.json()
    content: str = (data.get("message") or {}).get("content") or ""
    log.debug("llama_client raw (first 200): %r", content[:200])

    if not content:
        raise RuntimeError("llama server returned empty content")

    return content
