"""LangGraph single-node graph template.

Returns a predefined response. Replace logic and configuration as needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict
from typing_extensions import TypedDict

from langgraph.graph import StateGraph
from langgraph.runtime import Runtime
import os
import aiohttp
from dotenv import load_dotenv
import asyncio
load_dotenv()


async def brave_search(query: str, api_key: str) -> dict:
    """Perform a Brave Search API query with the same functionality as the curl command."""
    # pause for 1 second
    await asyncio.sleep(1)
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "x-subscription-token": api_key
    }
    params = {
        "q": query,
        "safesearch": "off",
        "count": 5
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params) as response:
            response.raise_for_status()
            return await response.json()

async def _perform_searches(state: dict) -> dict:
    statements_to_research = state["statements_to_research"]
    brave_api_key = os.getenv("BRAVE_API_KEY")

    if not brave_api_key:
        raise ValueError("BRAVE_API_KEY environment variable is not set")

    search_results = []
    for statement in statements_to_research:
        try:
            result = await brave_search(statement, brave_api_key)
            search_results.append({
                "statement": statement,
                "web_results": result["web"]["results"]
            })
        except Exception as e:
            search_results.append({
                "statement": statement,
                "error": str(e)
            })

    return {
        "statements_to_research": statements_to_research,
        "search_results": search_results
    }

# class Context(TypedDict):
#     """Context parameters for the agent.

#     Set these when creating assistants OR when invoking the graph.
#     See: https://langchain-ai.github.io/langgraph/cloud/how-tos/configuration_cloud/
#     """

#     my_configurable_param: str


@dataclass
class State:
    """Input state for the agent.

    Defines the initial structure of incoming data.
    See: https://langchain-ai.github.io/langgraph/concepts/low_level/#state
    """

    statements_to_research: list[str]
    search_results: list[dict] | None = None

# nodes
async def web_search(state: State) -> Dict[str, Any]:
    """Perform a web search using Brave Search API."""
    result = await _perform_searches({"statements_to_research": state.statements_to_research})
    return result


# Define the graph
graph = (
    StateGraph(State)
    .add_node(web_search)
    .add_edge("__start__", "web_search")
    .add_edge("web_search", "__end__")
    .compile(name="Research Pipeline")
)
