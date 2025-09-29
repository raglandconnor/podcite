"""Transcription API endpoints."""
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from ....services.transcription_service import transcription_service

router = APIRouter()


@router.get("/transcribe/{filename}")
async def transcribe_audio(filename: str, request: Request):
    """Transcribe an audio file and stream results as each chunk is processed.

    Args:
        filename: Name of the audio file in the media directory
        request: FastAPI request object for client disconnection detection

    Returns:
        Server-Sent Events stream with transcription results
    """

    async def generate_events() -> AsyncGenerator[dict, None]:
        """Generate SSE events for each transcription chunk."""
        try:
            async for result in transcription_service.transcribe_audio_file(filename):
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
