import logging
import httpx

from state import AgentState

logger = logging.getLogger(__name__)


async def kb_search_node(state: AgentState) -> dict:
    cfg = state["config"]
    kb_endpoint = cfg.get("kb_endpoint", "")
    mode = cfg.get("kb_mode", "hybrid")
    top_k = cfg.get("top_k", 10)
    max_depth = cfg.get("max_depth", 3)

    if not kb_endpoint:
        return {"kb_chunks": []}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{kb_endpoint}/search",
                json={"query": state["query"], "mode": mode, "top_k": top_k, "max_depth": max_depth},
            )
            resp.raise_for_status()
            chunks = resp.json().get("chunks", [])
            logger.info("kb_search | found %d chunks", len(chunks))
            return {"kb_chunks": chunks}
    except Exception as e:
        logger.warning("kb_search | failed: %s — returning empty", e)
        return {"kb_chunks": []}
