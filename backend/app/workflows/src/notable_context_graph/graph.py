"""LangGraph notable context AI workflow pipeline. Extracts anything worthy of further research from the podcast transcript."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, TypedDict

from langgraph.graph import StateGraph
from langchain_xai import ChatXAI
from pydantic import BaseModel, Field

import os
from dotenv import load_dotenv
load_dotenv()


def _extract_notable_context(state: dict) -> dict:
    transcript = state["transcript"]
    """Extract statements from transcript worthy of further research.
    
    Identifies claims, statistics, studies, references, and interesting statements
    that would benefit from fact-checking or deeper investigation.
    """
    prompt = f"""Analyze this podcast transcript and extract any statements that would be worthy of further research or fact-checking.

Look for:
- Specific claims, statistics, or data points
- References to studies, research, or experts
- Historical events or facts
- Companies, products, or technologies mentioned with specific details
- Controversial or surprising statements
- Causal claims (X causes Y)

Extract each notable statement as a concise, standalone phrase or sentence. Don't copy word-for-word unless necessary - rephrase for clarity while maintaining the key claim.

Transcript:
{transcript}"""

    result: NotableStatements = llm.invoke(prompt)
    return {
        "notable_context": result.statements
    }


class NotableStatements(BaseModel):
    """Structured output for notable statements extraction."""
    
    statements: list[str] = Field(
        description="List of notable statements from the transcript worthy of research"
    )


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

    transcript: str
    notable_context: list[str] = None


# Initialize LLM with structured output
llm = ChatXAI(
    model="grok-4-fast-non-reasoning",
    api_key=os.getenv("XAI_API_KEY"),
    temperature=0
).with_structured_output(NotableStatements)

# Nodes
def extract_notable_context(state: State) -> Dict[str, Any]:
    """Extract notable context from transcript."""
    result = _extract_notable_context({"transcript": state.transcript})
    return result


# Define the graph
graph = (
    StateGraph(State)
    .add_node(extract_notable_context)
    .add_edge("__start__", "extract_notable_context")
    .add_edge("extract_notable_context", "__end__")
    .compile(name="Notable Context Pipeline")
)
