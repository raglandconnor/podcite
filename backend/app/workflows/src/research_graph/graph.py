"""LangGraph multi-source research graph with intelligent routing.

Routes queries to appropriate search sources: Brave, arXiv, Congress.gov
"""

from __future__ import annotations

import os
from typing import Any, Dict

from langgraph.graph import StateGraph

from app.workflows.src.research_graph.models import State
from app.workflows.src.research_graph.router import route_statement
from app.workflows.src.research_graph.search import (
    arxiv_search,
    brave_search,
    congress_search,
)


async def router_node(state: State) -> Dict[str, Any]:
    """Analyze statements and decide which sources to query using Grok."""
    routing_decisions = []

    for statement in state.statements_to_research:
        sources = await route_statement(statement)
        routing_decisions.append({"statement": statement, "sources": sources})

    return {"routing_decisions": routing_decisions}


async def brave_search_node(state: State) -> Dict[str, Any]:
    """Search using Brave Search API."""
    brave_api_key = os.getenv("BRAVE_API_KEY")
    if not brave_api_key:
        return {"brave_results": []}

    results = []
    for decision in state.routing_decisions:
        if "brave" in decision["sources"]:
            statement = decision["statement"]
            try:
                result = await brave_search(statement, brave_api_key)
                results.append({
                    "statement": statement,
                    "source": "brave",
                    "results": result.get("web", {}).get("results", []),
                })
            except Exception as e:
                results.append({
                    "statement": statement,
                    "source": "brave",
                    "error": str(e),
                })

    return {"brave_results": results}


async def arxiv_search_node(state: State) -> Dict[str, Any]:
    """Search arXiv for scientific papers."""
    results = []
    for decision in state.routing_decisions:
        if "arxiv" in decision["sources"]:
            statement = decision["statement"]
            try:
                result = await arxiv_search(statement)
                results.append({
                    "statement": statement,
                    "source": "arxiv",
                    "query_used": result.get("query_used", ""),
                    "results": result.get("results", []),
                })
            except Exception as e:
                results.append({
                    "statement": statement,
                    "source": "arxiv",
                    "error": str(e),
                })

    return {"arxiv_results": results}


async def congress_search_node(state: State) -> Dict[str, Any]:
    """Search Congress.gov for legislation."""
    results = []
    for decision in state.routing_decisions:
        if "congress" in decision["sources"]:
            statement = decision["statement"]
            try:
                result = await congress_search(statement)
                results.append({
                    "statement": statement,
                    "source": "congress",
                    "query_used": result.get("query_used", ""),
                    "results": result.get("results", []),
                })
            except Exception as e:
                results.append({
                    "statement": statement,
                    "source": "congress",
                    "error": str(e),
                })

    return {"congress_results": results}


async def aggregate_results_node(state: State) -> Dict[str, Any]:
    """Combine all search results from different sources."""
    all_results = []

    for result_list in [
        state.brave_results,
        state.arxiv_results,
        state.congress_results,
    ]:
        if result_list:
            all_results.extend(result_list)

    return {"search_results": all_results}


graph = (
    StateGraph(State)
    .add_node("router", router_node)
    .add_node("brave_search", brave_search_node)
    .add_node("arxiv_search", arxiv_search_node)
    .add_node("congress_search", congress_search_node)
    .add_node("aggregate", aggregate_results_node)
    .add_edge("__start__", "router")
    .add_edge("router", "brave_search")
    .add_edge("router", "arxiv_search")
    .add_edge("router", "congress_search")
    .add_edge("brave_search", "aggregate")
    .add_edge("arxiv_search", "aggregate")
    .add_edge("congress_search", "aggregate")
    .add_edge("aggregate", "__end__")
    .compile(name="Research Pipeline")
)
