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


class AudioDownloadResponse(BaseModel):
    """Response model for audio download status."""
    status: str  # "success", "error", "skipped"
    file_path: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    error: Optional[str] = None


class RSSParseResponse(BaseModel):
    """Response model for RSS feed parsing."""
    podcast: PodcastInfo
    episode: Episode
    total_episodes_in_feed: int
    audio_download: AudioDownloadResponse


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
