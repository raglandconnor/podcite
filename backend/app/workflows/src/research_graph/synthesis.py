"""LLM-based synthesis and verification of research results."""

import os
from typing import Any

from dotenv import load_dotenv
from langchain_xai import ChatXAI

from app.workflows.src.research_graph.models import StatementVerification

load_dotenv()


synthesis_llm = ChatXAI(
    model="grok-4-fast-non-reasoning",
    api_key=os.getenv("XAI_API_KEY"),
    temperature=0.3,
).with_structured_output(StatementVerification)


def _format_search_results(statement: str, search_results: list[dict]) -> str:
    """Format search results into a readable context for the LLM."""
    context_parts = []

    for result in search_results:
        if result.get("error"):
            continue

        source_type = result.get("source", "unknown")
        statement_text = result.get("statement", statement)

        if source_type == "brave":
            results = result.get("results", [])
            if results:
                context_parts.append(f"\n### WEB SEARCH RESULTS")
                for idx, item in enumerate(results[:5], 1):
                    title = item.get("title", "No title")
                    url = item.get("url", "")
                    description = item.get("description", "No description")
                    context_parts.append(
                        f"{idx}. {title}\n   URL: {url}\n   Description: {description}"
                    )

        elif source_type == "arxiv":
            results = result.get("results", [])
            if results:
                context_parts.append(f"\n### SCIENTIFIC PAPERS (arXiv)")
                for idx, paper in enumerate(results[:5], 1):
                    title = paper.get("title", "No title")
                    url = paper.get("url", "")
                    authors = ", ".join(paper.get("authors", [])[:3])
                    if len(paper.get("authors", [])) > 3:
                        authors += " et al."
                    summary = paper.get("summary", "No summary")
                    published = paper.get("published", "Unknown date")
                    context_parts.append(
                        f"{idx}. {title}\n   Authors: {authors}\n   Published: {published}\n   URL: {url}\n   Abstract: {summary}"
                    )

        elif source_type == "congress":
            results = result.get("results", [])
            if results:
                context_parts.append(f"\n### LEGISLATION (Congress.gov)")
                for idx, bill in enumerate(results[:5], 1):
                    bill_number = bill.get("bill_number", "Unknown")
                    title = bill.get("title", "No title")
                    url = bill.get("url", "")
                    latest_action = bill.get("latest_action", "No action")
                    latest_action_date = bill.get("latest_action_date", "Unknown date")
                    context_parts.append(
                        f"{idx}. {bill_number}: {title}\n   URL: {url}\n   Latest Action ({latest_action_date}): {latest_action}"
                    )

    if not context_parts:
        return "No search results available."

    return "\n".join(context_parts)


async def synthesize_statement(
    statement: str, search_results: list[dict]
) -> dict[str, Any]:
    """Synthesize search results to verify/refute a statement with confidence scoring.

    Args:
        statement: The statement to verify
        search_results: List of search results from various sources

    Returns:
        Dictionary containing verification data (statement, verdict, confidence, summary, reasoning, sources)
    """
    # Format search results into readable context
    context = _format_search_results(statement, search_results)

    prompt = f"""You are a research assistant analyzing sources to provide information about a query.

QUERY:
"{statement}"

AVAILABLE SOURCES:
{context}

YOUR TASK:
Analyze the sources and determine whether this is:
1. A factual claim that can be verified/refuted
2. A term, concept, or topic that needs explanation
3. A question seeking information

VERDICT OPTIONS:
- "verified": Sources strongly support a factual claim
- "refuted": Sources contradict or disprove a factual claim
- "partial": Sources partially support a claim or show mixed evidence
- "inconclusive": This is informational (definition of a term) or insufficient evidence for verification

CONFIDENCE SCORING (0.0 to 1.0):
For factual claims:
- Source Authority: Academic papers (0.3), Government sources (0.25), Reputable news/orgs (0.2), General web (0.1)
- Cross-Source Agreement: Multiple sources agree (0.3), Single source (0.1)
- Specificity: Direct evidence (0.2), Related but indirect (0.1), Tangential (0.05)
- Recency: Recent (0.15), Somewhat dated (0.1), Old (0.05)

For informational queries (terms, concepts, questions):
- Use "inconclusive" verdict with moderate confidence (0.4-0.7) based on source quality
- Focus on explaining what the sources say about the topic

SUMMARY REQUIREMENTS:
- Keep to 1-2 sentences maximum
- For factual claims: State what the sources say about the claim
- For informational queries: Provide a concise explanation/definition based on sources
- Be specific about findings
- Do NOT just repeat the query

REASONING REQUIREMENTS:
- Explain which sources were most relevant
- For factual claims: Note agreement or disagreement between sources
- For informational queries: Explain what information the sources provide
- Justify confidence score
- Mention any limitations or caveats

SOURCES LIST:
- Extract the most relevant source URLs (3-5 max)
- Include title and type (arxiv/web/legislation)
- Explain each source's relevance in one sentence

Be helpful and informative. If the query is asking for information rather than verification, provide that information from the sources."""

    try:
        result: StatementVerification = await synthesis_llm.ainvoke(prompt)
        return result.model_dump()
    except Exception as e:
        # Fallback response if synthesis fails
        return {
            "statement": statement,
            "verdict": "inconclusive",
            "confidence": 0.0,
            "summary": f"Unable to synthesize results due to error: {str(e)}",
            "reasoning": "Synthesis failed",
            "sources": [],
        }

