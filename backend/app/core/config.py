"""Core configuration for the application."""
from pathlib import Path

import httpx

# Media directory configuration
MEDIA_DIR = Path("media")
MEDIA_DIR.mkdir(exist_ok=True)

# Reusable HTTP client for better performance
http_client = httpx.AsyncClient(
    follow_redirects=True,
    timeout=30.0,
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
)

# Create settings object
class Settings:
    MEDIA_DIR: Path = MEDIA_DIR

settings = Settings()
