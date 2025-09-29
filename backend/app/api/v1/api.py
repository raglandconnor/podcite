"""Main API router that includes all endpoint routers."""
from fastapi import APIRouter

from .endpoints import podcast

api_router = APIRouter()
api_router.include_router(podcast.router, prefix="/podcasts", tags=["podcasts"])
