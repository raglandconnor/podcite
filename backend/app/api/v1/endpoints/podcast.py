"""Podcast-related API endpoints."""
from fastapi import APIRouter, HTTPException, Query

from ....core.exceptions import RSSParseError
from ....models.podcast import RSSParseResponse
from ....services.podcast_service import parse_rss_feed

router = APIRouter()


@router.get("/parse-rss", response_model=RSSParseResponse)
async def parse_rss_feed_endpoint(
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
        return await parse_rss_feed(url, episode_index)
    except RSSParseError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing RSS feed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint.

    Returns:
        dict: Application health status
    """
    return {"status": "healthy"}
