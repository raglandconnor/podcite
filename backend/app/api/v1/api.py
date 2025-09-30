"""Main API router that includes all endpoint routers."""
from fastapi import APIRouter

from .endpoints import podcast, transcription, research

api_router = APIRouter()
api_router.include_router(podcast.router, prefix="/podcasts", tags=["podcasts"])
api_router.include_router(transcription.router, prefix="/transcription", tags=["transcription"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
