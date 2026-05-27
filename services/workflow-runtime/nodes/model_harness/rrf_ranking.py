import logging
from state import AgentState

logger = logging.getLogger(__name__)

_K = 60
_TOP_N = 20


def rrf_ranking_node(state: AgentState) -> dict:
    kb_chunks = state.get("kb_chunks", [])
    mcp_results = state.get("mcp_results", [])
    all_items = kb_chunks + mcp_results

    if not all_items:
        return {"rrf_results": []}

    scores: dict[str, float] = {}
    meta: dict[str, dict] = {}

    for rank, item in enumerate(kb_chunks):
        item_id = item["id"]
        scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (_K + rank + 1)
        meta[item_id] = item

    for rank, item in enumerate(mcp_results):
        item_id = item["id"]
        scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (_K + rank + 1)
        meta[item_id] = item

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    top_20 = [meta[i] for i in sorted_ids[:_TOP_N]]

    logger.info("rrf_ranking | merged %d items → top %d", len(all_items), len(top_20))
    return {"rrf_results": top_20}
