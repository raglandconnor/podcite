"""Search API functions for different sources."""

import asyncio
import os

import aiohttp
import arxiv
from dotenv import load_dotenv
from langchain_xai import ChatXAI

from app.workflows.src.research_graph.models import ArxivQuery

load_dotenv()


async def brave_search(query: str, api_key: str) -> dict:
    """Perform a Brave Search API query."""
    await asyncio.sleep(1)
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "x-subscription-token": api_key,
    }
    params = {"q": query, "safesearch": "off", "count": 5}

    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params) as response:
            response.raise_for_status()
            return await response.json()


arxiv_llm = ChatXAI(
    model="grok-4-fast-non-reasoning",
    api_key=os.getenv("XAI_API_KEY"),
    temperature=0,
).with_structured_output(ArxivQuery)


async def optimize_arxiv_query(question: str) -> str:
    """Use LLM to transform question into effective arXiv search query."""
    prompt = f"""You are an expert at constructing arXiv search queries. Transform the user's question into a precise arXiv search query.

Question: "{question}"

IMPORTANT RULES:
1. DO NOT copy the entire question verbatim
2. Extract ONLY the key research concepts and technical terms
3. Use field prefixes strategically: ti: (title), abs: (abstract), au: (author), cat: (category)
4. Combine terms with AND/OR/ANDNOT operators
5. Keep queries concise - focus on 2-4 key terms maximum
6. For paper titles or specific papers, use ti: prefix with key words from the title
7. For broad topics, use abs: prefix to search abstracts

GOOD Examples:
Input: "What research exists on quantum computing for cryptography?"
Output: abs:quantum AND abs:computing AND abs:cryptography

Input: "Studies about neural networks and deep learning"
Output: abs:neural AND abs:network OR abs:deep AND abs:learning

Input: "Papers by Geoffrey Hinton on backpropagation"
Output: au:Hinton AND abs:backpropagation


Now generate a query following these rules."""

    result = await arxiv_llm.ainvoke(prompt)
    return result.query


def _fetch_arxiv_papers(optimized_query: str) -> list:
    """Synchronous function to fetch arXiv papers (run in thread)."""
    search = arxiv.Search(
        query=optimized_query,
        max_results=5,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    
    results = []
    for paper in search.results():
        results.append({
            "title": paper.title,
            "authors": [author.name for author in paper.authors],
            "summary": paper.summary[:500],  # Truncate long abstracts
            "published": paper.published.isoformat(),
            "url": paper.entry_id,
            "pdf_url": paper.pdf_url,
        })
    return results


async def arxiv_search(query: str) -> dict:
    """Search arXiv for scientific papers."""
    try:
        # Optimize query using LLM
        optimized_query = await optimize_arxiv_query(query)

        # Run blocking arxiv library call in thread pool
        results = await asyncio.to_thread(_fetch_arxiv_papers, optimized_query)

        return {
            "results": results,
            "total_results": len(results),
            "query_used": optimized_query,
        }

    except Exception as e:
        return {
            "results": [],
            "total_results": 0,
            "error": str(e),
        }


async def congress_search(query: str) -> dict:
    """Search Congress.gov for legislation and bills.

    TODO: Implement using Congress.gov API
    API: https://api.congress.gov/v3/
    """
    return {
        "results": [],
        "total_results": 0,
        "note": "Congress.gov search not yet implemented",
    }

