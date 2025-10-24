"use client";

import { useState, useRef, useEffect } from "react";
import RSSInputForm from "../components/RSSInputForm";
import PodcastInfo from "../components/PodcastInfo";
import EpisodeInfo from "../components/EpisodeInfo";
import ResearchPanel from "../components/ResearchPanel";
import {
  extractNotableContext,
  getAudioChunkInfo,
  researchStatements,
  ResearchItem,
} from "../lib/api";

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
    totalChunks: 0,
    chunkDurationSeconds: 120,
    lastTranscribedChunkIndex: -1,
    transcribedChunkIndices: [] as number[],
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const prevTimeRef = useRef(0);

  // Unified research items state
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [lastExtractedTime, setLastExtractedTime] = useState(-1);
  const isResearchingRef = useRef(false);

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
        totalChunks: 0,
        chunkDurationSeconds: 120,
        lastTranscribedChunkIndex: -1,
        transcribedChunkIndices: [],
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

  const loadChunks = async (
    filename: string,
    startChunk: number,
    endChunk: number
  ) => {
    if (transcription.isTranscribing) {
      console.log("Already transcribing, skipping load request");
      return;
    }

    // Check if chunks are already transcribed
    const alreadyTranscribed = [];
    for (let i = startChunk; i <= endChunk; i++) {
      if (transcription.transcribedChunkIndices.includes(i)) {
        alreadyTranscribed.push(i);
      }
    }
    if (alreadyTranscribed.length === endChunk - startChunk + 1) {
      console.log(`Chunks ${startChunk}-${endChunk} already transcribed`);
      return;
    }

    console.log(`Loading chunks ${startChunk} to ${endChunk}`);

    setTranscription((prev) => ({
      ...prev,
      isTranscribing: true,
      error: null,
    }));

    const eventSource = new EventSource(
      `http://localhost:8000/api/v1/transcription/chunks/${filename}?start_chunk=${startChunk}&end_chunk=${endChunk}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data.startsWith("data: ") ? event.data.slice(6) : event.data
        );

        if (data.status === "completed") {
          setTranscription((prev) => ({
            ...prev,
            isTranscribing: false,
            stream: null,
          }));
          eventSource.close();
          return;
        }

        if (data.error) {
          setTranscription((prev) => ({
            ...prev,
            error: data.error,
            isTranscribing: false,
            stream: null,
          }));
          eventSource.close();
          return;
        }

        if (data.chunk_index && data.total_chunks) {
          const chunkIdx = data.chunk_index - 1; // Convert to 0-based
          setTranscription((prev) => {
            // Add chunk index if not already present
            const newTranscribedIndices = prev.transcribedChunkIndices.includes(
              chunkIdx
            )
              ? prev.transcribedChunkIndices
              : [...prev.transcribedChunkIndices, chunkIdx];

            return {
              ...prev,
              chunks: [...prev.chunks, data as TranscriptionChunk],
              lastTranscribedChunkIndex: Math.max(
                prev.lastTranscribedChunkIndex,
                chunkIdx
              ),
              transcribedChunkIndices: newTranscribedIndices,
            };
          });
        }
      } catch (err) {
        console.error("Failed to parse transcription data:", err);
      }
    };

    eventSource.onerror = () => {
      setTranscription((prev) => ({
        ...prev,
        error: "Connection error during transcription",
        isTranscribing: false,
        stream: null,
      }));
      eventSource.close();
    };

    setTranscription((prev) => ({ ...prev, stream: eventSource }));
  };

  const initializeTranscription = async (filename: string) => {
    try {
      console.log("Fetching audio chunk info...");
      const info = await getAudioChunkInfo(filename);
      console.log("Audio info:", info);

      setTranscription((prev) => ({
        ...prev,
        totalChunks: info.total_chunks,
        chunkDurationSeconds: info.chunk_duration_seconds,
      }));

      // Load first 2 chunks
      await loadChunks(filename, 0, 1);
    } catch (err) {
      console.error("Failed to initialize transcription:", err);
      setTranscription((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to initialize",
      }));
    }
  };

  const handleAudioPlay = () => {
    if (
      data?.audio_download.filename &&
      transcription.totalChunks === 0 &&
      !transcription.isTranscribing
    ) {
      initializeTranscription(data.audio_download.filename);
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

  // Trigger research whenever there are pending items
  useEffect(() => {
    const researchNextPending = async () => {
      if (isResearchingRef.current) return;

      // Find the first pending item
      const pendingItem = researchItems.find(
        (item) => item.status === "pending"
      );
      if (!pendingItem) return;

      isResearchingRef.current = true;

      // Update status to researching
      setResearchItems((prev) =>
        prev.map((item) =>
          item.id === pendingItem.id ? { ...item, status: "researching" } : item
        )
      );

      try {
        const result = await researchStatements([pendingItem.question]);
        const verification = result.synthesized_results[0];

        setResearchItems((prev) =>
          prev.map((item) =>
            item.id === pendingItem.id
              ? { ...item, status: "completed", results: verification }
              : item
          )
        );
      } catch (err) {
        setResearchItems((prev) =>
          prev.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: "error",
                  error: err instanceof Error ? err.message : "Research failed",
                }
              : item
          )
        );
      } finally {
        isResearchingRef.current = false;
      }
    };

    researchNextPending();
  }, [researchItems]);

  // Handle manual text selection
  const handleTextSelected = (text: string) => {
    const newItem: ResearchItem = {
      id: `manual-${Date.now()}`,
      question: text,
      type: "manual",
      timestamp: currentTime,
      status: "pending",
    };
    setResearchItems((prev) => [...prev, newItem]);
  };

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
    if (Math.abs(lastExtractedTime - chunkStartTime) < 1) {
      return; // Already extracted for this chunk
    }

    // Extract notable context
    const extractContext = async () => {
      setLastExtractedTime(chunkStartTime);

      try {
        const result = await extractNotableContext(currentChunk.text);

        // Add all questions as pending research items
        if (result.notable_context && Array.isArray(result.notable_context)) {
          const newItems: ResearchItem[] = result.notable_context.map(
            (question: string, idx: number) => ({
              id: `notable-${chunkStartTime}-${idx}`,
              question,
              type: "notable" as const,
              timestamp: chunkStartTime,
              status: "pending" as const,
            })
          );

          setResearchItems((prev) => [...prev, ...newItems]);
        }
      } catch (err) {
        console.error("Failed to extract notable context:", err);
      }
    };

    extractContext();
  }, [currentTime, transcription.chunks, lastExtractedTime]);

  // Progressive chunk loading based on playback position
  useEffect(() => {
    if (
      !data?.audio_download.filename ||
      transcription.totalChunks === 0 ||
      transcription.isTranscribing
    ) {
      return;
    }

    const lastChunkIndex = transcription.lastTranscribedChunkIndex;
    if (lastChunkIndex === -1) return;

    // Check if we've reached 50% through the last transcribed chunk
    const lastChunkStartTime =
      lastChunkIndex * transcription.chunkDurationSeconds;
    const lastChunkEndTime =
      (lastChunkIndex + 1) * transcription.chunkDurationSeconds;
    const midpoint = (lastChunkStartTime + lastChunkEndTime) / 2;

    // Load next chunk when past midpoint
    if (
      currentTime >= midpoint &&
      lastChunkIndex + 1 < transcription.totalChunks
    ) {
      console.log(
        `Reached midpoint of chunk ${lastChunkIndex}, loading next chunk`
      );
      loadChunks(
        data.audio_download.filename,
        lastChunkIndex + 1,
        lastChunkIndex + 1
      );
    }
  }, [
    currentTime,
    transcription.lastTranscribedChunkIndex,
    transcription.totalChunks,
    transcription.chunkDurationSeconds,
    transcription.isTranscribing,
    data?.audio_download.filename,
  ]);

  // Seek detection and gap filling
  useEffect(() => {
    if (
      !data?.audio_download.filename ||
      transcription.totalChunks === 0 ||
      transcription.chunkDurationSeconds === 0
    ) {
      return;
    }

    const timeDiff = currentTime - prevTimeRef.current;

    // Detect forward seek (jump > 2 seconds)
    if (timeDiff > 2) {
      console.log(
        `Detected forward seek from ${prevTimeRef.current} to ${currentTime}`
      );

      const currentChunkIndex = Math.floor(
        currentTime / transcription.chunkDurationSeconds
      );

      // Check if current position is in an untranscribed chunk
      if (!transcription.transcribedChunkIndices.includes(currentChunkIndex)) {
        console.log(`Seeking to untranscribed chunk ${currentChunkIndex}`);

        // Load the current chunk and the next one
        const endChunk = Math.min(
          currentChunkIndex + 1,
          transcription.totalChunks - 1
        );
        loadChunks(data.audio_download.filename, currentChunkIndex, endChunk);
      }
    }

    prevTimeRef.current = currentTime;
  }, [
    currentTime,
    transcription.totalChunks,
    transcription.chunkDurationSeconds,
    transcription.transcribedChunkIndices,
    data?.audio_download.filename,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => transcription.stream?.close();
  }, [transcription.stream]);

  return (
    <div className='min-h-screen p-8'>
      <div className='max-w-7xl mx-auto space-y-8'>
        <div>
          <h1 className='text-3xl font-bold mb-2'>Podcast Source Listener</h1>
          <p className='text-muted-foreground'>
            Parse RSS feeds and extract context from podcast episodes
          </p>
        </div>

        <RSSInputForm
          rssUrl={rssUrl}
          onRssUrlChange={setRssUrl}
          onParse={parseRSS}
          loading={loading}
        />

        {error && (
          <div className='p-4 border border-destructive/20 bg-destructive/10 text-destructive rounded-md'>
            Error: {error}
          </div>
        )}

        {data && (
          <div className='space-y-6'>
            <PodcastInfo
              title={data.podcast.title}
              description={data.podcast.description}
              imageUrl={data.podcast.image_url}
              rssUrl={data.podcast.rss_url}
              totalEpisodes={data.total_episodes_in_feed}
            />

            <div className='grid grid-cols-1 lg:grid-cols-[1fr_700px] gap-6 w-full overflow-hidden'>
              <div className='min-w-0 overflow-hidden'>
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
                  onTextSelected={handleTextSelected}
                />
              </div>

              <div className='min-w-0 overflow-hidden w-full max-w-[700px]'>
                <ResearchPanel items={researchItems} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
