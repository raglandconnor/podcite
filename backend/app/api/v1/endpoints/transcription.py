"""Transcription API endpoints."""
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from ....services.transcription_service import transcription_service

router = APIRouter()


@router.get("/info/{filename}")
async def get_audio_info(filename: str):
    """Get audio file metadata including chunk information.
    
    Args:
        filename: Name of the audio file in the media directory
    
    Returns:
        JSON with total_chunks, chunk_duration_seconds, total_duration_seconds
    """
    info = transcription_service.get_audio_info(filename)
    if info is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Audio file {filename} not found"}
        )
    return info


@router.get("/chunks/{filename}")
async def transcribe_audio_chunks(
    filename: str, 
    request: Request,
    start_chunk: int = Query(..., description="Starting chunk index (0-based)"),
    end_chunk: int = Query(..., description="Ending chunk index (0-based, inclusive)")
):
    """Transcribe specific chunks of an audio file and stream results.
    
    Args:
        filename: Name of the audio file in the media directory
        request: FastAPI request object for client disconnection detection
        start_chunk: Starting chunk index (0-based)
        end_chunk: Ending chunk index (0-based, inclusive)
    
    Returns:
        Server-Sent Events stream with transcription results
    """
    
    async def generate_events() -> AsyncGenerator[dict, None]:
        """Generate SSE events for each transcription chunk."""
        try:
            async for result in transcription_service.transcribe_specific_chunks(
                filename, start_chunk, end_chunk
            ):
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                # Yield dict - EventSourceResponse will format it as SSE
                yield {"data": json.dumps(result)}

            # Send completion event
            if not await request.is_disconnected():
                yield {"data": json.dumps({"status": "completed"})}

        except Exception as e:
            if not await request.is_disconnected():
                yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate_events())
