from langgraph.graph import StateGraph, START, END
from state import AgentState
from nodes.model_harness.planner import planner_node
from nodes.model_harness.reasoner import reasoner_node
from nodes.model_harness.rrf_ranking import rrf_ranking_node
from nodes.model_harness.reranker import reranker_node
from nodes.sandbox.kb_search import kb_search_node
from nodes.sandbox.mcp import mcp_node


def route_after_planner(state: AgentState) -> list[str]:
    tool_calls = state.get("tool_calls", [])
    types = {tc.get("type") for tc in tool_calls}
    destinations = []
    if "kb_search" in types or not tool_calls:
        destinations.append("kb_search")
    if "mcp" in types:
        destinations.append("mcp")
    return destinations or ["kb_search"]


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("planner",     planner_node)
    builder.add_node("kb_search",   kb_search_node)
    builder.add_node("mcp",         mcp_node)
    builder.add_node("rrf_ranking", rrf_ranking_node)
    builder.add_node("reranker",    reranker_node)
    builder.add_node("reasoner",    reasoner_node)

    builder.add_edge(START, "planner")
    builder.add_conditional_edges("planner", route_after_planner, ["kb_search", "mcp"])
    builder.add_edge("kb_search",   "rrf_ranking")
    builder.add_edge("mcp",         "rrf_ranking")
    builder.add_edge("rrf_ranking", "reranker")
    builder.add_edge("reranker",    "reasoner")
    builder.add_edge("reasoner",    END)

    return builder.compile()
