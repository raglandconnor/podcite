"""Research endpoint for LangGraph workflow."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.workflows.src.research_graph.graph import graph
from app.workflows.src.notable_context_graph.graph import graph as notable_context_graph

router = APIRouter()


class ResearchRequest(BaseModel):
    statements_to_research: list[str]

class TranscriptChunk(BaseModel):
    transcript: str


@router.post("/research")
async def research_statements(request: ResearchRequest):
    """Execute research workflow on provided statements."""
    try:
        result = await graph.ainvoke({"statements_to_research": request.statements_to_research})
        return {"search_results": result["search_results"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract_notable_context")
async def extract_notable_context(request: TranscriptChunk):
    """Execute notable context workflow on provided statements."""
    try:
        result = await notable_context_graph.ainvoke({"transcript": request.transcript})
        return {"notable_context": result["notable_context"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))