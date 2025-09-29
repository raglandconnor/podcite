"""Transcription service for audio processing using OpenAI Whisper."""
import asyncio
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional, Tuple

from openai import OpenAI
from pydub import AudioSegment

from ..core.config import settings


class TranscriptionService:
    """Service for transcribing audio files using OpenAI Whisper API."""

    CHUNK_DURATION_MS = 2 * 60 * 1000  # 2 minutes

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def chunk_audio_file(self, audio_file_path: Path, chunk_duration_ms: int = CHUNK_DURATION_MS) -> Optional[List[AudioSegment]]:
        """Chunk an audio file into segments of specified duration."""
        try:
            audio = AudioSegment.from_file(audio_file_path)
            chunks = []
            for i in range(0, len(audio), chunk_duration_ms):
                chunk = audio[i:i + chunk_duration_ms]
                chunks.append(chunk)
            return chunks
        except Exception as e:
            print(f"Error chunking {audio_file_path}: {e}")
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
            # Clean up temp file (NamedTemporaryFile handles this automatically)
            return result
        except Exception as e:
            print(f"Error transcribing chunk: {e}")
            return None

    async def transcribe_audio_file(self, filename: str) -> AsyncGenerator[Dict, None]:
        """Transcribe an audio file and yield results for each chunk as it's processed."""
        audio_file_path = settings.MEDIA_DIR / filename
        if not audio_file_path.exists():
            yield {"error": f"Audio file {filename} not found"}
            return

        print(f"Chunking and transcribing: {filename}")
        chunks = self.chunk_audio_file(audio_file_path)
        if not chunks:
            yield {"error": "Failed to chunk audio file"}
            return

        print(f"Created {len(chunks)} chunks")
        chunk_duration_sec = self.CHUNK_DURATION_MS // 1000

        for i, chunk in enumerate(chunks):
            print(f"Transcribing chunk {i+1}/{len(chunks)}...")
            transcription = await self.transcribe_audio_chunk(chunk)

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
                    "total_chunks": len(chunks),
                    "text": transcription.text,
                    "segments": segments
                }
            else:
                yield {
                    "chunk_index": i + 1,
                    "total_chunks": len(chunks),
                    "error": f"Failed to transcribe chunk {i+1}"
                }


transcription_service = TranscriptionService()
