"""Pydantic models for the research graph."""

from dataclasses import dataclass, field
from pydantic import BaseModel, Field


class RoutingDecision(BaseModel):
    """Structured output for routing decisions."""

    sources: list[str] = Field(
        description=(
            "List of sources to query. Options: 'brave' (general web search), "
            "'arxiv' (scientific papers), 'congress' (US legislation). "
            "Must contain at least one source."
        )
    )


class ArxivQuery(BaseModel):
    """Optimized arXiv search query."""

    query: str = Field(
        description="Optimized search query for arXiv API using field prefixes like ti: (title), abs: (abstract), au: (author), cat: (category)"
    )
    explanation: str = Field(
        description="Brief explanation of how the query was optimized"
    )


@dataclass
class State:
    """State for the research pipeline."""

    statements_to_research: list[str]
    routing_decisions: list[dict] = field(default_factory=list)
    brave_results: list[dict] = field(default_factory=list)
    arxiv_results: list[dict] = field(default_factory=list)
    congress_results: list[dict] = field(default_factory=list)
    search_results: list[dict] | None = None

