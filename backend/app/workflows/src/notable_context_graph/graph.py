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
    """Extract only high-value statements worthy of research.
    
    Applies strict criteria to identify only the most research-worthy claims.
    Formats outputs as questions a listener would naturally ask.
    """
    prompt = f"""You are analyzing a podcast transcript to identify ONLY the most research-worthy statements that would genuinely benefit from fact-checking, deeper investigation, or clarification for complex concepts.

BE HIGHLY SELECTIVE. Extract ONLY statements that meet AT LEAST TWO of these criteria:

1. **Specific, verifiable claims**: Concrete statistics, data points, or numerical claims (e.g., "70% increase in productivity")
2. **Research citations**: Explicit mentions of studies, papers, universities, or research institutions
3. **Expert or authority references**: Named experts, scientists, authors, or their specific work
4. **Surprising/counterintuitive claims**: Statements that challenge common beliefs and would benefit from verification
5. **Causal claims with significant implications**: Bold "X causes Y" statements that could be verified
6. **Historical facts with specific details**: Dates, events, or historical claims that can be fact-checked
7. **Vague references without specifics ("some studies show...")**: Statements that are not specific enough to be verified
8. **Highly complex concepts**: Statements involving very difficult or niche technical, scientific, or academic concepts that are not commonly understood and would benefit from a quick summary or explanation (e.g., "quantum entanglement in neural networks")

DO NOT extract:
- General opinions or subjective statements
- Common knowledge or widely accepted facts
- Future predictions or speculation
- Simple product descriptions or company mentions
- Complex concepts that are relatively well-known or easily understood by a general audience

FORMAT: Phrase each extraction as a natural question a curious listener would ask while listening. The question should capture what the listener would want to research, verify, or have explained.

Examples:
✅ "What study found that remote workers are 13% more productive?"
✅ "Who is Dr. Sarah Chen and what is her research on AI safety?"
✅ "Is it true that coffee consumption reduces Alzheimer's risk by 65%?"
✅ "What is quantum entanglement in neural networks and how does it work?"
✗ "What do they think about remote work?" (too vague)
✗ "What's their opinion on AI?" (subjective opinion)
✗ "How does their product work?" (product description, not research-worthy)
✗ "What is gravity?" (commonly understood concept)

Transcript:
{transcript}

Remember: Quality over quantity. Extract 0-5 questions maximum. If nothing meets the strict criteria, return an empty list."""

    result: NotableStatements = llm.invoke(prompt)
    return {
        "notable_context": result.statements
    }

class NotableStatements(BaseModel):
    """Structured output for notable statements extraction."""
    
    statements: list[str] = Field(
        description="List of research-worthy questions a listener would ask, formatted as natural questions. Maximum 5 questions. Can be empty if nothing meets criteria."
    )


# class Context(TypedDict):
#     """Context parameters for the agent.

#     Set these when creating assistants OR when invoking the graph.
#     See: https://langchain-ai.github.io/langgraph/cloud/how-tos/configuration_cloud/
#     """

#     my_configurable_param: str


@dataclass
class State:
    """Input and output state for the notable context extraction agent.

    Input:
        transcript: Raw podcast transcript text to analyze
        
    Output:
        notable_context: List of research-worthy questions (0-5) that a listener
                        would naturally ask. Empty list if no statements meet 
                        the strict extraction criteria.
    
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
