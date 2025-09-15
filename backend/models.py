"""Pydantic models for the Podcast Source Listener API."""
from pydantic import BaseModel
from typing import Optional


class PodcastInfo(BaseModel):
    """Podcast metadata information."""
    title: str
    description: str
    image_url: str
    rss_url: str


class Episode(BaseModel):
    """Single podcast episode information."""
    title: str
    description: str
    audio_url: Optional[str] = None
    published_date: str
    duration: str
    episode_index: int


class RSSParseResponse(BaseModel):
    """Response model for RSS feed parsing."""
    podcast: PodcastInfo
    episode: Episode
    total_episodes_in_feed: int


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
