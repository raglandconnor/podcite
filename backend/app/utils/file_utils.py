"""Utility functions for file operations."""
import os
import re
from urllib.parse import urlparse


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
