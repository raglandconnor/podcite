"""Search API functions for different sources."""

import asyncio
import os

import aiohttp
import arxiv
from dotenv import load_dotenv
from langchain_xai import ChatXAI

from app.workflows.src.research_graph.models import ArxivQuery, CongressQuery

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


congress_llm = ChatXAI(
    model="grok-4-fast-non-reasoning",
    api_key=os.getenv("XAI_API_KEY"),
    temperature=0,
).with_structured_output(CongressQuery)


async def optimize_congress_query(question: str) -> str:
    """Use LLM to transform question into effective Congress.gov search query.
    
    Returns: optimized_query with proper search operators
    """
    prompt = f'''You are an expert at constructing NEUTRAL Congress.gov API search queries to find bills/acts for fact-checking.

Statement: "{question}"

YOUR GOAL: Extract only the factual entities (bill names, policy topics, sponsors) to find relevant legislation. DO NOT include any claims, sentiments, or context about passage, failure, support, or opposition.

CRITICAL RULES:
1. IGNORE sentiment/claims: "didn't pass", "failed", "blocked", "supported", "opposed", etc.
2. EXTRACT ONLY: Bill names, policy topics, sponsor names, subject matter
3. BE NEUTRAL: Just find the bills mentioned so they can be examined to verify/disprove the claim

SEARCH OPERATOR RULES:
1. Use AND to require all terms (e.g., "climate AND energy")
2. Use OR for alternative terms (e.g., "healthcare OR insurance")
3. Use quotes "" for exact phrases (e.g., "climate change")
4. Use wildcards * for variations (e.g., "educat*")
5. Combine with parentheses for complex queries
6. DO NOT USE NOT operator to exclude claims - stay neutral

GOOD Examples:
Input: "I heard they didn't pass the climate change bill"
Output: "climate change" OR climate

Input: "Senator Warren's banking reform bill was blocked"
Output: Warren AND ("banking reform" OR bank* OR financial)

Input: "The Infrastructure Investment and Jobs Act failed"
Output: "Infrastructure Investment and Jobs Act"

Input: "Congress rejected the healthcare expansion proposal"
Output: healthcare AND expansion

Input: "Biden signed the Inflation Reduction Act"
Output: "Inflation Reduction Act"

Input: "The border security bill was withdrawn"
Output: "border security" OR border

Input: "AOC opposed the tech regulation bill"
Output: (AOC OR "Alexandria Ocasio-Cortez") AND (tech* AND regulation)

Now generate a NEUTRAL query that finds the bill/act to verify the statement.'''

    result = await congress_llm.ainvoke(prompt)
    return result.query


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
    """Search Congress.gov for legislation and bills using optimized search operators."""
    api_key = os.getenv("CONGRESS_API_KEY")
    if not api_key:
        return {
            "results": [],
            "total_results": 0,
            "error": "CONGRESS_API_KEY not configured",
        }
    
    try:
        # Optimize query using LLM with search operators
        optimized_query = await optimize_congress_query(query)
        
        base_url = "https://api.congress.gov/v3/bill"
        
        headers = {
            "Accept": "application/json",
        }
        
        params = {
            "api_key": api_key,
            "format": "json",
            "limit": 10,
            "offset": 0,
        }
        
        # Add the optimized search query with operators
        if optimized_query:
            params["query"] = optimized_query
        
        # Make API request
        async with aiohttp.ClientSession() as session:
            async with session.get(base_url, headers=headers, params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                # Parse bill results
                results = []
                bills = data.get("bills", [])
                
                for bill in bills[:5]:
                    # Extract bill details
                    title = bill.get("title", "")
                    number = bill.get("number", "")
                    bill_type = bill.get("type", "")
                    congress = bill.get("congress", "")
                    
                    # Build full bill identifier
                    bill_identifier = f"{bill_type} {number}" if bill_type and number else ""
                    
                    latest_action = bill.get("latestAction", {})
                    latest_action_text = latest_action.get("text", "") if latest_action else ""
                    latest_action_date = latest_action.get("actionDate", "") if latest_action else ""
                    
                    result_item = {
                        "bill_number": bill_identifier,
                        "title": title,
                        "congress": congress,
                        "type": bill_type,
                        "introduced_date": bill.get("introducedDate", ""),
                        "latest_action": latest_action_text,
                        "latest_action_date": latest_action_date,
                        "url": bill.get("url", ""),
                        "origin_chamber": bill.get("originChamber", ""),
                    }
                    
                    results.append(result_item)
                
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

