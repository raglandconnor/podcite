"""Pydantic models for the research graph."""

from dataclasses import dataclass, field
from pydantic import BaseModel, Field
from typing import Literal


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


class CongressQuery(BaseModel):
    """Optimized Congress.gov search query."""

    query: str = Field(
        description="Optimized search query for Congress.gov API using search operators like AND, OR, NOT, quotes for exact phrases, wildcards (*), and proximity searches (~N)"
    )
    explanation: str = Field(
        description="Brief explanation of how the query was optimized and which operators were used"
    )


class SourceLink(BaseModel):
    """Individual source with metadata."""

    url: str = Field(description="Direct URL to the source")
    title: str = Field(description="Title of the source")
    type: Literal["arxiv", "web", "legislation"] = Field(
        description="Type of source: arxiv (scientific paper), web (general web content), or legislation (congressional bill)"
    )
    relevance: str = Field(
        description="Brief explanation of how this source relates to the statement (1 sentence)"
    )


class StatementVerification(BaseModel):
    """Verification result for a statement with confidence scoring."""

    statement: str = Field(description="The original statement being verified")
    verdict: Literal["verified", "refuted", "inconclusive", "partial"] = Field(
        description="Overall verdict: verified (sources support), refuted (sources contradict), inconclusive (insufficient evidence), partial (mixed or limited support)"
    )
    confidence: float = Field(
        description="Confidence score from 0.0 to 1.0 based on source quality, agreement, and specificity",
        ge=0.0,
        le=1.0,
    )
    summary: str = Field(
        description="Concise 1-2 sentence summary of what the sources reveal about the statement"
    )
    reasoning: str = Field(
        description="Detailed explanation of the verdict and confidence score, including source analysis and cross-referencing"
    )
    sources: list[SourceLink] = Field(
        description="List of relevant sources with URLs and metadata"
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
    synthesized_results: list[dict] = field(default_factory=list)

