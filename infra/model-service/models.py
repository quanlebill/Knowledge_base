"""
Module-level model state. Call load() once at startup; routers use get_embed() / get_rerank().
"""
from __future__ import annotations

import logging

from sentence_transformers import CrossEncoder, SentenceTransformer

log = logging.getLogger(__name__)

_embed_model: SentenceTransformer | None = None
_rerank_model: CrossEncoder | None = None


def load(embed_name: str, rerank_name: str) -> None:
    global _embed_model, _rerank_model
    log.info("Loading embedding model %s …", embed_name)
    _embed_model = SentenceTransformer(embed_name)
    log.info("Loading reranker model %s …", rerank_name)
    _rerank_model = CrossEncoder(rerank_name)
    log.info("Both models ready")


def get_embed() -> SentenceTransformer:
    if _embed_model is None:
        raise RuntimeError("Models not loaded — call load() first")
    return _embed_model


def get_rerank() -> CrossEncoder:
    if _rerank_model is None:
        raise RuntimeError("Models not loaded — call load() first")
    return _rerank_model


def is_ready() -> bool:
    return _embed_model is not None and _rerank_model is not None
