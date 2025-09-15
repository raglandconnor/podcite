"""Custom exceptions for the Podcast Source Listener API."""
from fastapi import HTTPException


class RSSParseError(HTTPException):
    """Custom exception for RSS parsing errors."""
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)
