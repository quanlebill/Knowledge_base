from langgraph.graph import StateGraph, START, END
from state import AgentState
from nodes.guardrail import guardrail_input_node, guardrail_output_node
from nodes.model_harness.planner import planner_node
from nodes.model_harness.responder import responder_node
from nodes.model_harness.rrf_ranking import rrf_ranking_node
from nodes.model_harness.reranker import reranker_node
from nodes.sandbox.kb_search import kb_search_node
from nodes.sandbox.mcp import mcp_node


def _route_after_guardrail_input(state: AgentState) -> str:
    """Short-circuit: blocked query skips the entire pipeline."""
    return "guardrail_output" if state.get("guardrail_triggered") else "planner"


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

    builder.add_node("guardrail_input",  guardrail_input_node)
    builder.add_node("planner",           planner_node)
    builder.add_node("kb_search",        kb_search_node)
    builder.add_node("mcp",              mcp_node)
    builder.add_node("rrf_ranking",      rrf_ranking_node)
    builder.add_node("reranker",         reranker_node)
    builder.add_node("responder",      responder_node)
    builder.add_node("guardrail_output", guardrail_output_node)

    builder.add_edge(START, "guardrail_input")
    builder.add_conditional_edges(
        "guardrail_input",
        _route_after_guardrail_input,
        {"planner": "planner", "guardrail_output": "guardrail_output"},
    )
    builder.add_conditional_edges("planner", route_after_planner, ["kb_search", "mcp"])
    builder.add_edge("kb_search",        "rrf_ranking")
    builder.add_edge("mcp",              "rrf_ranking")
    builder.add_edge("rrf_ranking",      "reranker")
    builder.add_edge("reranker",         "responder")
    builder.add_edge("responder",      "guardrail_output")
    builder.add_edge("guardrail_output", END)

    return builder.compile()
