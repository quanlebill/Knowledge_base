from langgraph.graph import StateGraph, START, END

from state import AgentState
from nodes.model_harness.planner import planner_node
from nodes.model_harness.reasoner import reasoner_node


def build_graph():
    builder = StateGraph(AgentState)
    builder.add_node("planner", planner_node)
    builder.add_node("reasoner", reasoner_node)
    builder.add_edge(START, "planner")
    builder.add_edge("planner", "reasoner")
    builder.add_edge("reasoner", END)
    return builder.compile()
