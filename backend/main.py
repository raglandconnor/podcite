from fastapi import FastAPI, HTTPException, Query
import feedparser

from models import PodcastInfo, Episode, RSSParseResponse, HealthResponse
from exceptions import RSSParseError

app = FastAPI(title="Podcast Source Listener API", version="0.1.0")


@app.get("/")
async def root():
    return {"message": "Podcast Source Listener API"}


@app.get("/parse-rss", response_model=RSSParseResponse)
async def parse_rss_feed(
    url: str = Query(..., description="RSS feed URL to parse"),
    episode_index: int = Query(0, ge=0, description="Episode index to retrieve")
) -> RSSParseResponse:
    """Parse RSS feed and return podcast info with a single episode.
    
    Args:
        url: The RSS feed URL to parse
        episode_index: The index of the episode to retrieve (default: 0)
        
    Returns:
        RSSParseResponse: Podcast and episode information
        
    Raises:
        RSSParseError: When RSS feed is invalid or cannot be parsed
        HTTPException: When episode index is out of range or other errors occur
    """
    try:
        # Parse the RSS feed
        feed = feedparser.parse(url)
        
        # Check if parsing was successful
        if feed.bozo and not feed.entries:
            raise RSSParseError("Invalid RSS feed URL or format")
        
        # Check if requested episode exists
        if episode_index >= len(feed.entries):
            raise HTTPException(
                status_code=404, 
                detail=f"Episode {episode_index} not found. Feed has {len(feed.entries)} episodes."
            )
        
        # Extract podcast info
        podcast_info = PodcastInfo(
            title=feed.feed.get("title", "Unknown Podcast"),
            description=feed.feed.get("description", ""),
            image_url=feed.feed.get("image", {}).get("href", ""),
            rss_url=url,
        )
        
        # Extract single episode
        entry = feed.entries[episode_index]
        
        # Find audio URL from enclosures
        audio_url = None
        if hasattr(entry, 'enclosures') and entry.enclosures:
            for enclosure in entry.enclosures:
                if enclosure.type.startswith('audio/'):
                    audio_url = enclosure.href
                    break
        
        episode = Episode(
            title=entry.get("title", "Unknown Episode"),
            description=entry.get("summary", ""),
            audio_url=audio_url,
            published_date=entry.get("published", ""),
            duration=entry.get("itunes_duration", ""),
            episode_index=episode_index,
        )
        
        return RSSParseResponse(
            podcast=podcast_info,
            episode=episode,
            total_episodes_in_feed=len(feed.entries)
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
