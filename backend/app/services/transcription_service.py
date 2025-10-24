"""Transcription service for audio processing using OpenAI Whisper."""
import asyncio
import json
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Dict, Optional

from openai import OpenAI
from pydub import AudioSegment

from ..core.config import settings


class TranscriptionService:
    """Service for transcribing audio files using OpenAI Whisper API."""

    CHUNK_DURATION_MS = 2 * 60 * 1000  # 2 minutes

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def _get_audio_duration(self, audio_file_path: Path) -> Optional[float]:
        """Get audio duration in seconds using ffprobe (fast, no loading into memory)."""
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error", "-show_entries", 
                    "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
                    str(audio_file_path)
                ],
                capture_output=True,
                text=True,
                check=True
            )
            return float(result.stdout.strip())
        except Exception as e:
            print(f"Error getting audio duration with ffprobe: {e}")
            return None

    def prepare_audio_chunks(self, filename: str) -> Optional[Dict]:
        """Pre-chunk audio file using ffmpeg directly (fast, no memory loading).
        
        Creates directory structure:
        media/
          audio.mp3              # Original file stays here
          audio/                 # Chunk directory
            metadata.json
            chunks/
              chunk_000.mp3
              chunk_001.mp3
              ...
        
        Returns:
            Dict with total_chunks, chunk_duration_seconds, total_duration_seconds
        """
        audio_file_path = settings.MEDIA_DIR / filename
        if not audio_file_path.exists():
            print(f"Audio file not found: {audio_file_path}")
            return None
        
        try:
            # Create directory structure
            base_name = audio_file_path.stem
            audio_dir = settings.MEDIA_DIR / base_name
            chunks_dir = audio_dir / "chunks"
            chunks_dir.mkdir(parents=True, exist_ok=True)
            
            # Get duration quickly without loading the file
            print(f"Getting audio duration from {audio_file_path}")
            total_duration_sec = self._get_audio_duration(audio_file_path)
            if total_duration_sec is None:
                return None
            
            total_duration_ms = int(total_duration_sec * 1000)
            chunk_duration_sec = self.CHUNK_DURATION_MS / 1000
            num_chunks = (total_duration_ms + self.CHUNK_DURATION_MS - 1) // self.CHUNK_DURATION_MS
            
            print(f"Splitting into {num_chunks} chunks using ffmpeg (parallel)...")
            
            # Define ffmpeg split function for parallel processing
            def split_chunk(chunk_index: int) -> None:
                """Split a single chunk using ffmpeg directly (fast)."""
                start_sec = chunk_index * chunk_duration_sec
                chunk_path = chunks_dir / f"chunk_{chunk_index:03d}.mp3"
                
                # Use ffmpeg to extract chunk directly from file
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-v", "error",
                        "-ss", str(start_sec),
                        "-t", str(chunk_duration_sec),
                        "-i", str(audio_file_path),
                        "-ac", "1",  # mono
                        "-b:a", "64k",  # lower bitrate
                        "-map", "0:a",  # only audio stream
                        str(chunk_path)
                    ],
                    check=True
                )
            
            # Split chunks in parallel
            with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
                list(executor.map(split_chunk, range(num_chunks)))
            
            # Create metadata
            metadata = {
                "total_chunks": num_chunks,
                "chunk_duration_seconds": chunk_duration_sec,
                "total_duration_seconds": total_duration_sec,
                "chunk_duration_ms": self.CHUNK_DURATION_MS,
                "created_at": datetime.now().isoformat()
            }
            
            # Save metadata
            metadata_path = audio_dir / "metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"Successfully prepared {num_chunks} chunks for {filename}")
            return metadata
            
        except Exception as e:
            print(f"Error preparing chunks for {filename}: {e}")
            return None

    async def transcribe_audio_chunk(self, audio_chunk: AudioSegment, model: str = "whisper-1") -> Optional[object]:
        """Transcribe an audio chunk using OpenAI Whisper API with timestamps."""
        def _transcribe():
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                audio_chunk.export(temp_file.name, format="mp3")
                with open(temp_file.name, "rb") as audio_file:
                    return self.client.audio.transcriptions.create(
                        file=audio_file,
                        model=model,
                        response_format="verbose_json",
                        timestamp_granularities=["segment"]
                    )

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, _transcribe)
            return result
        except Exception as e:
            print(f"Error transcribing chunk: {e}")
            return None

    def get_audio_info(self, filename: str) -> Optional[Dict]:
        """Get audio file metadata including chunk information.
        
        Reads from cached metadata.json if available, otherwise prepares chunks first.
        """
        # Check for cached metadata first
        base_name = Path(filename).stem
        audio_dir = settings.MEDIA_DIR / base_name
        metadata_path = audio_dir / "metadata.json"
        
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                return {
                    "total_chunks": metadata["total_chunks"],
                    "chunk_duration_seconds": metadata["chunk_duration_seconds"],
                    "total_duration_seconds": metadata["total_duration_seconds"]
                }
            except Exception as e:
                print(f"Error reading cached metadata: {e}")
        
        # Fallback: prepare chunks if metadata doesn't exist
        print(f"Metadata not found for {filename}, preparing chunks...")
        metadata = self.prepare_audio_chunks(filename)
        if metadata:
            return {
                "total_chunks": metadata["total_chunks"],
                "chunk_duration_seconds": metadata["chunk_duration_seconds"],
                "total_duration_seconds": metadata["total_duration_seconds"]
            }
        
        return None

    async def transcribe_specific_chunks(
        self, 
        filename: str, 
        start_chunk: int, 
        end_chunk: int
    ) -> AsyncGenerator[Dict, None]:
        """Transcribe specific chunk range from an audio file using pre-chunked files."""
        base_name = Path(filename).stem
        audio_dir = settings.MEDIA_DIR / base_name
        chunks_dir = audio_dir / "chunks"
        metadata_path = audio_dir / "metadata.json"
        
        # Check if chunks exist, if not prepare them
        if not metadata_path.exists() or not chunks_dir.exists():
            print(f"Chunks not found for {filename}, preparing...")
            metadata = self.prepare_audio_chunks(filename)
            if not metadata:
                yield {"error": "Failed to prepare audio chunks"}
                return
        else:
            # Load metadata
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
            except Exception as e:
                yield {"error": f"Failed to read metadata: {e}"}
                return
        
        total_chunks = metadata["total_chunks"]
        chunk_duration_sec = int(metadata["chunk_duration_seconds"])
        
        print(f"Loading pre-chunked files, transcribing {start_chunk} to {end_chunk}")
        
        # Validate chunk range
        if start_chunk < 0 or end_chunk >= total_chunks or start_chunk > end_chunk:
            yield {"error": f"Invalid chunk range: {start_chunk}-{end_chunk} (total: {total_chunks})"}
            return

        # Transcribe only the requested chunk range by loading individual chunk files
        for i in range(start_chunk, end_chunk + 1):
            chunk_path = chunks_dir / f"chunk_{i:03d}.mp3"
            
            if not chunk_path.exists():
                yield {
                    "chunk_index": i + 1,
                    "total_chunks": total_chunks,
                    "error": f"Chunk file not found: {chunk_path}"
                }
                continue
            
            # Load individual chunk file
            try:
                audio_chunk = AudioSegment.from_file(chunk_path)
                print(f"Transcribing chunk {i+1}/{total_chunks} from {chunk_path.name}...")
                transcription = await self.transcribe_audio_chunk(audio_chunk)

                if transcription:
                    time_offset = i * chunk_duration_sec
                    segments = [
                        {
                            "start": segment.start + time_offset,
                            "end": segment.end + time_offset,
                            "text": segment.text
                        }
                        for segment in getattr(transcription, 'segments', [])
                    ]

                    yield {
                        "chunk_index": i + 1,
                        "total_chunks": total_chunks,
                        "text": transcription.text,
                        "segments": segments
                    }
                else:
                    yield {
                        "chunk_index": i + 1,
                        "total_chunks": total_chunks,
                        "error": f"Failed to transcribe chunk {i+1}"
                    }
            except Exception as e:
                yield {
                    "chunk_index": i + 1,
                    "total_chunks": total_chunks,
                    "error": f"Error loading chunk {i+1}: {e}"
                }


transcription_service = TranscriptionService()
