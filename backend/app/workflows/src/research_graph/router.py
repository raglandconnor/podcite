"""Routing logic for determining which search sources to query."""

import os
from typing import List

from dotenv import load_dotenv
from langchain_xai import ChatXAI

from app.workflows.src.research_graph.models import RoutingDecision

load_dotenv()


def route_statement(statement: str) -> List[str]:
    """Use grok to determine which sources to query.

    Returns list of source names: ['brave', 'arxiv', 'congress']
    """
    prompt = f"""You are a routing agent that determines which search sources are relevant for a statement.

Available sources:
- brave: General web search for news, companies, people, general facts
- arxiv: Scientific papers, research studies, academic publications
- congress: US legislation, bills, congressional hearings, policy

Analyze this statement and decide which sources to query:

Statement: "{statement}"

Rules:
- Select ALL relevant sources (can be multiple)
- Always include 'brave' unless the statement is purely academic or legislative
- Include 'arxiv' only if the statement references research, studies, papers, or scientific concepts
- Include 'congress' only if the statement references US legislation, bills, policy, or congressional matters"""

    try:
        result: RoutingDecision = routing_llm.invoke(prompt)
        sources = result.sources

        valid_sources = ["brave", "arxiv", "congress"]
        sources = [s for s in sources if s in valid_sources]

        if not sources:
            sources = ["brave"]

        return sources

    except Exception as e:
        print(f"Routing error: {e}, falling back to brave search")
        return ["brave"]


routing_llm = ChatXAI(
    model="grok-4-fast-non-reasoning",
    api_key=os.getenv("XAI_API_KEY"),
    temperature=0,
).with_structured_output(RoutingDecision)

