"use client";

import { useState, useRef, useEffect } from "react";
import RSSInputForm from "../components/RSSInputForm";
import PodcastInfo from "../components/PodcastInfo";
import EpisodeInfo from "../components/EpisodeInfo";
import NotableContextDisplay from "../components/NotableContextDisplay";
import { extractNotableContext } from "../lib/api";

interface PodcastData {
  podcast: {
    title: string;
    description: string;
    image_url: string;
    rss_url: string;
  };
  episode: {
    title: string;
    description: string;
    audio_url: string;
    published_date: string;
    duration: string;
    episode_index: number;
  };
  total_episodes_in_feed: number;
  audio_download: {
    status: string;
    file_path: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    error: string | null;
  };
}

interface TranscriptionChunk {
  chunk_index: number;
  total_chunks: number;
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  error?: string;
}

export default function Home() {
  const [rssUrl, setRssUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PodcastData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [transcription, setTranscription] = useState({
    chunks: [] as TranscriptionChunk[],
    error: null as string | null,
    isTranscribing: false,
    completed: false,
    stream: null as EventSource | null,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [notableContext, setNotableContext] = useState({
    data: null as any,
    isLoading: false,
    error: null as string | null,
    lastExtractedTime: -1,
  });

  const parseRSS = async () => {
    if (!rssUrl) return;

    setLoading(true);
    setError(null);
    setData(null);

    // Reset transcription state
    setTranscription((prev) => {
      prev.stream?.close();
      return {
        chunks: [],
        error: null,
        isTranscribing: false,
        completed: false,
        stream: null,
      };
    });

    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/podcasts/parse-rss?url=${encodeURIComponent(
          rssUrl
        )}`
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse RSS feed");
    } finally {
      setLoading(false);
    }
  };

  const startTranscription = async (filename: string) => {
    if (transcription.isTranscribing || transcription.completed || !filename)
      return;

    setTranscription((prev) => ({
      ...prev,
      isTranscribing: true,
      error: null,
      chunks: [],
      completed: false,
    }));

    const eventSource = new EventSource(
      `http://localhost:8000/api/v1/transcription/transcribe/${filename}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data.startsWith("data: ") ? event.data.slice(6) : event.data
        );
        console.log("Transcription API result:", data);

        if (data.status === "completed") {
          setTranscription((prev) => ({
            ...prev,
            isTranscribing: false,
            completed: true,
          }));
          eventSource.close();
          return;
        }

        if (data.error) {
          setTranscription((prev) => ({
            ...prev,
            error: data.error,
            isTranscribing: false,
          }));
          eventSource.close();
          return;
        }

        if (data.chunk_index && data.total_chunks) {
          setTranscription((prev) => ({
            ...prev,
            chunks: [...prev.chunks, data as TranscriptionChunk],
          }));
        }
      } catch (err) {
        console.error("Failed to parse transcription data:", err);
        console.log("Raw event data that failed to parse:", event.data);
      }
    };

    eventSource.onerror = (error) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setTranscription((prev) => ({
          ...prev,
          isTranscribing: false,
          completed: true,
        }));
      } else {
        setTranscription((prev) => ({
          ...prev,
          error: "Connection error during transcription",
          isTranscribing: false,
        }));
      }
      eventSource.close();
    };

    setTranscription((prev) => ({ ...prev, stream: eventSource }));
  };

  const stopTranscription = () => {
    transcription.stream?.close();
    setTranscription((prev) => ({
      ...prev,
      stream: null,
      isTranscribing: false,
    }));
  };

  const handleAudioPlay = () => {
    if (
      data?.audio_download.filename &&
      !transcription.isTranscribing &&
      !transcription.completed &&
      !transcription.chunks.length
    ) {
      startTranscription(data.audio_download.filename);
    }
  };

  // Track audio currentTime
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [data?.audio_download.filename]);

  // Extract notable context automatically based on current playback position
  useEffect(() => {
    // Don't extract if no transcription chunks yet
    if (transcription.chunks.length === 0) return;
    // Don't extract if audio isn't playing
    if (!audioRef.current || audioRef.current.paused) return;

    // Find the chunk that contains the current time
    const currentChunk = transcription.chunks.find((chunk) => {
      const segments = chunk.segments;
      if (segments.length === 0) return false;
      const firstSegmentTime = segments[0].start;
      const lastSegmentTime = segments[segments.length - 1].end;
      return currentTime >= firstSegmentTime && currentTime <= lastSegmentTime;
    });

    if (!currentChunk) return;

    // Check if we've already extracted for this chunk
    const chunkStartTime = currentChunk.segments[0].start;
    if (Math.abs(notableContext.lastExtractedTime - chunkStartTime) < 1) {
      return; // Already extracted for this chunk
    }

    // Extract notable context
    const extractContext = async () => {
      setNotableContext((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        lastExtractedTime: chunkStartTime,
      }));

      try {
        const result = await extractNotableContext(currentChunk.text);
        setNotableContext((prev) => ({
          ...prev,
          data: result,
          isLoading: false,
        }));
      } catch (err) {
        setNotableContext((prev) => ({
          ...prev,
          error:
            err instanceof Error ? err.message : "Failed to extract context",
          isLoading: false,
        }));
      }
    };

    extractContext();
  }, [currentTime, transcription.chunks, notableContext.lastExtractedTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => transcription.stream?.close();
  }, [transcription.stream]);

  return (
    <div className='min-h-screen p-8 bg-gray-50'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-3xl font-bold text-gray-900 mb-8'>
          Podcast RSS Parser
        </h1>

        <RSSInputForm
          rssUrl={rssUrl}
          onRssUrlChange={setRssUrl}
          onParse={parseRSS}
          loading={loading}
        />

        {error && (
          <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md'>
            Error: {error}
          </div>
        )}

        {data && (
          <div className='space-y-6'>
            {/* Podcast Info */}
            <PodcastInfo
              title={data.podcast.title}
              description={data.podcast.description}
              imageUrl={data.podcast.image_url}
              rssUrl={data.podcast.rss_url}
              totalEpisodes={data.total_episodes_in_feed}
            />

            {/* Main Content Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Episode Info & Player */}
              <div>
                <EpisodeInfo
                  ref={audioRef}
                  title={data.episode.title}
                  description={data.episode.description}
                  publishedDate={data.episode.published_date}
                  duration={data.episode.duration}
                  audioDownload={{
                    status: data.audio_download.status,
                    filename: data.audio_download.filename,
                    contentType: data.audio_download.content_type,
                  }}
                  transcription={transcription}
                  onAudioPlay={handleAudioPlay}
                  currentTime={currentTime}
                />
              </div>

              {/* Notable Context Panel */}
              <div className='bg-white p-6 rounded-lg shadow'>
                <NotableContextDisplay
                  context={notableContext.data}
                  isLoading={notableContext.isLoading}
                  error={notableContext.error}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
