"""Research endpoint for LangGraph workflow."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.workflows.research_pipeline.src.agent.graph import graph

router = APIRouter()


class ResearchRequest(BaseModel):
    statements_to_research: list[str]


@router.post("/")
async def research_statements(request: ResearchRequest):
    """Execute research workflow on provided statements."""
    try:
        result = await graph.ainvoke({"statements_to_research": request.statements_to_research})
        return {"search_results": result["search_results"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

