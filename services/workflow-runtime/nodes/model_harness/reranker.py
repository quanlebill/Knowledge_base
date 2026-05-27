import logging
import os
import litellm

from state import AgentState

logger = logging.getLogger(__name__)

_LITELLM_BASE = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
_LITELLM_KEY = os.environ.get("LITELLM_API_KEY", "sk-dev")


def reranker_node(state: AgentState) -> dict:
    rrf_results = state.get("rrf_results", [])
    if not rrf_results:
        return {"reranked_chunks": []}

    top_n = state["config"].get("reranker_top_n", 5)
    documents = [item["content"] for item in rrf_results]

    try:
        response = litellm.rerank(
            model="openai/embedder",
            api_base=_LITELLM_BASE,
            api_key=_LITELLM_KEY,
            query=state["query"],
            documents=documents,
            top_n=top_n,
        )
        reranked = sorted(response.results, key=lambda x: x.relevance_score, reverse=True)
        top_chunks = [rrf_results[r.index] for r in reranked]
        logger.info("reranker | reranked %d → top %d", len(rrf_results), len(top_chunks))
        return {"reranked_chunks": top_chunks}
    except Exception as e:
        # reranker not available (no embedder model that supports rerank) — fallback to rrf order
        logger.warning("reranker | failed: %s — using rrf order as fallback", e)
        return {"reranked_chunks": rrf_results[:top_n]}
