"""Core package."""
from .config import http_client, settings
from .exceptions import RSSParseError

__all__ = ["http_client", "settings", "RSSParseError"]
