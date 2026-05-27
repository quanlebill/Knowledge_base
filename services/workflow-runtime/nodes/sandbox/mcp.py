import logging
import httpx

from state import AgentState

logger = logging.getLogger(__name__)


async def mcp_node(state: AgentState) -> dict:
    mcp_endpoints = state["config"].get("mcp_endpoints", [])
    if not mcp_endpoints:
        return {"mcp_results": []}

    mcp_calls = [tc for tc in state.get("tool_calls", []) if tc.get("type") == "mcp"]
    if not mcp_calls:
        return {"mcp_results": []}

    all_results = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for call in mcp_calls:
            tool_name = call.get("tool_name", "")
            endpoint = next(
                (ep for ep in mcp_endpoints if ep.get("name") == call.get("endpoint_name")),
                mcp_endpoints[0],
            )
            try:
                resp = await client.post(
                    f"{endpoint['url']}/execute",
                    json={"tool_name": tool_name, "query": state["query"]},
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])
                all_results.extend(results)
                logger.info("mcp | tool=%s endpoint=%s → %d results", tool_name, endpoint["url"], len(results))
            except Exception as e:
                logger.warning("mcp | tool=%s endpoint=%s failed: %s", tool_name, endpoint.get("url"), e)

    return {"mcp_results": all_results}
