from typing import List
from typing_extensions import TypedDict


class AgentState(TypedDict):
    query: str
    messages: List[dict]
    tool_calls: List[dict]
    kb_chunks: List[dict]
    mcp_results: List[dict]
    rrf_results: List[dict]
    reranked_chunks: List[dict]
    response: str
    config: dict
