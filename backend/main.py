import os
import re
from pathlib import Path
from urllib.parse import urlparse

import aiofiles
import feedparser
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from exceptions import RSSParseError
from models import AudioDownloadResponse, Episode, HealthResponse, PodcastInfo, RSSParseResponse

app = FastAPI(title="Podcast Source Listener API", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

MEDIA_DIR = Path("media")
MEDIA_DIR.mkdir(exist_ok=True)

# Mount static files for media serving
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


def create_safe_filename(url: str) -> str:
    """Create a safe filename from a URL."""
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)

    # If no filename in URL, create one from the URL
    if not filename:
        filename = re.sub(r'[^\w\-_\.]', '_', parsed.netloc + parsed.path) + '.mp3'

    # Make it safe by replacing problematic characters
    safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)

    # Ensure it has an extension
    if not safe_filename.lower().endswith(('.mp3', '.m4a', '.wav', '.aac')):
        safe_filename += '.mp3'

    return safe_filename


def extract_podcast_info(feed, rss_url: str) -> PodcastInfo:
    """Extract podcast information from parsed RSS feed."""
    return PodcastInfo(
        title=feed.feed.get("title", "Unknown Podcast"),
        description=feed.feed.get("description", ""),
        image_url=feed.feed.get("image", {}).get("href", ""),
        rss_url=rss_url,
    )


def extract_episode_info(entry, episode_index: int) -> Episode:
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
    """Download audio file from URL."""
    if not audio_url:
        return AudioDownloadResponse(status="error", error="No audio URL found in RSS feed")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(audio_url)

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
            file_path = MEDIA_DIR / filename

            # Handle duplicates
            counter = 1
            original_filename = filename
            while file_path.exists():
                name, ext = os.path.splitext(original_filename)
                filename = f"{name}_{counter}{ext}"
                file_path = MEDIA_DIR / filename
                counter += 1

            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(response.content)

            return AudioDownloadResponse(
                status="success",
                file_path=str(file_path),
                filename=filename,
                content_type=content_type,
                size_bytes=len(response.content)
            )

    except Exception as e:
        return AudioDownloadResponse(status="error", error=str(e))


@app.get("/")
async def root():
    return {"message": "Podcast Source Listener API"}


@app.get("/parse-rss", response_model=RSSParseResponse)
async def parse_rss_feed(
    url: str = Query(..., description="RSS feed URL to parse"),
    episode_index: int = Query(0, ge=0, description="Episode index to retrieve")
) -> RSSParseResponse:
    """Parse RSS feed and return podcast info with a single episode.
    Automatically downloads the audio file to the media directory.

    Args:
        url: The RSS feed URL to parse
        episode_index: The index of the episode to retrieve (default: 0)

    Returns:
        RSSParseResponse: Podcast and episode information with download status

    Raises:
        RSSParseError: When RSS feed is invalid or cannot be parsed
        HTTPException: When episode index is out of range or other errors occur
    """
    try:
        feed = feedparser.parse(url)

        if feed.bozo and not feed.entries:
            raise RSSParseError("Invalid RSS feed URL or format")

        if episode_index >= len(feed.entries):
            raise HTTPException(
                status_code=404,
                detail=f"Episode {episode_index} not found. Feed has {len(feed.entries)} episodes."
            )

        podcast_info = extract_podcast_info(feed, url)
        episode = extract_episode_info(feed.entries[episode_index], episode_index)
        download_result = await download_audio(episode.audio_url)

        return RSSParseResponse(
            podcast=podcast_info,
            episode=episode,
            total_episodes_in_feed=len(feed.entries),
            audio_download=download_result
        )

    except RSSParseError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing RSS feed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint.

    Returns:
        HealthResponse: Application health status
    """
    return HealthResponse(status="healthy")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
