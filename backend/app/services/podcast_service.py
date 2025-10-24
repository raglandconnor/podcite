"""Podcast service containing business logic for podcast operations."""
import asyncio
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import aiofiles
import aiofiles.os
import feedparser

from ..core.config import http_client, settings
from ..models.podcast import AudioDownloadResponse, Episode, PodcastInfo, RSSParseResponse
from ..utils.file_utils import create_safe_filename
from ..services.transcription_service import transcription_service


async def parse_rss_feed(url: str, episode_index: int) -> RSSParseResponse:
    """Parse RSS feed and return podcast info with a single episode.
    Automatically downloads the audio file to the media directory.

    Args:
        url: The RSS feed URL to parse
        episode_index: The index of the episode to retrieve

    Returns:
        RSSParseResponse: Podcast and episode information with download status

    Raises:
        RSSParseError: When RSS feed is invalid or cannot be parsed
        HTTPException: When episode index is out of range
    """
    from ..core.exceptions import RSSParseError
    from fastapi import HTTPException

    # Run blocking RSS parsing in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as executor:
        feed = await loop.run_in_executor(executor, feedparser.parse, url)

    if feed.bozo and not feed.entries:
        raise RSSParseError("Invalid RSS feed URL or format")

    if episode_index >= len(feed.entries):
        raise HTTPException(
            status_code=404,
            detail=f"Episode {episode_index} not found. Feed has {len(feed.entries)} episodes."
        )

    podcast_info = _extract_podcast_info(feed, url)
    episode = _extract_episode_info(feed.entries[episode_index], episode_index)
    download_result = await download_audio(episode.audio_url)

    return RSSParseResponse(
        podcast=podcast_info,
        episode=episode,
        total_episodes_in_feed=len(feed.entries),
        audio_download=download_result
    )


def _extract_podcast_info(feed, rss_url: str) -> PodcastInfo:
    """Extract podcast information from parsed RSS feed."""
    return PodcastInfo(
        title=feed.feed.get("title", "Unknown Podcast"),
        description=feed.feed.get("description", ""),
        image_url=feed.feed.get("image", {}).get("href", ""),
        rss_url=rss_url,
    )


def _extract_episode_info(entry, episode_index: int) -> Episode:
    """Extract episode information from RSS entry."""
    # Find audio URL from enclosures
    audio_url = None
    if hasattr(entry, 'enclosures') and entry.enclosures:
        for enclosure in entry.enclosures:
            if enclosure.type.startswith('audio/'):
                audio_url = enclosure.href
                break

    return Episode(
        title=entry.get("title", "Unknown Episode"),
        description=entry.get("summary", ""),
        audio_url=audio_url,
        published_date=entry.get("published", ""),
        duration=entry.get("itunes_duration", ""),
        episode_index=episode_index,
    )


async def download_audio(audio_url: str) -> AudioDownloadResponse:
    """Download audio file from URL and prepare chunks for transcription."""
    if not audio_url:
        return AudioDownloadResponse(status="error", error="No audio URL found in RSS feed")

    try:
        # Use shared HTTP client for connection reuse
        response = await http_client.get(audio_url)

        if response.status_code != 200:
            return AudioDownloadResponse(
                status="error",
                error=f"HTTP {response.status_code}"
            )

        content_type = response.headers.get('content-type', '').lower()
        if not (content_type.startswith('audio/') or 'mp3' in content_type or 'mpeg' in content_type):
            return AudioDownloadResponse(
                status="error",
                error=f"Invalid content type: {content_type}"
            )

        filename = create_safe_filename(audio_url)
        file_path = settings.MEDIA_DIR / filename

        # Handle duplicates with async file operations
        counter = 1
        original_filename = filename
        while await aiofiles.os.path.exists(file_path):
            name, ext = os.path.splitext(original_filename)
            filename = f"{name}_{counter}{ext}"
            file_path = settings.MEDIA_DIR / filename
            counter += 1

        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(response.content)

        # Pre-chunk the audio file immediately after download
        print(f"Preparing audio chunks for {filename}...")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, transcription_service.prepare_audio_chunks, filename)
        print(f"Audio chunks prepared for {filename}")

        return AudioDownloadResponse(
            status="success",
            file_path=str(file_path),
            filename=filename,
            content_type=content_type,
            size_bytes=len(response.content)
        )

    except Exception as e:
        return AudioDownloadResponse(status="error", error=str(e))
