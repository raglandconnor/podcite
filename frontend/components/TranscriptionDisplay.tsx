import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionChunk {
  chunk_index: number;
  total_chunks: number;
  text: string;
  segments: TranscriptionSegment[];
  error?: string;
}

interface TranscriptionDisplayProps {
  chunks: TranscriptionChunk[];
  isTranscribing: boolean;
  error: string | null;
  currentTime: number;
  onTextSelected?: (text: string) => void;
}

export default function TranscriptionDisplay({
  chunks,
  isTranscribing,
  error,
  currentTime,
  onTextSelected,
}: TranscriptionDisplayProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSegmentRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const prevActiveKeyRef = useRef<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");

  // Filter and flatten segments based on current time
  const visibleSegments: Array<{
    segment: TranscriptionSegment;
    absoluteStartTime: number;
    absoluteEndTime: number;
    chunkIndex: number;
    segmentIndex: number;
    isActive: boolean;
  }> = [];

  chunks.forEach((chunk, chunkIndex) => {
    chunk.segments.forEach((segment, segmentIndex) => {
      const absoluteStartTime = segment.start;
      const absoluteEndTime = segment.end;

      // Only show segments up to the current time
      if (absoluteStartTime <= currentTime) {
        const isActive =
          absoluteStartTime <= currentTime && absoluteEndTime > currentTime;

        visibleSegments.push({
          segment,
          absoluteStartTime,
          absoluteEndTime,
          chunkIndex,
          segmentIndex,
          isActive,
        });
      }
    });
  });

  // Determine current active segment key (fallback to last visible if none active)
  const activeIndex = visibleSegments.findIndex((item) => item.isActive);
  const activeKey =
    activeIndex >= 0
      ? `${visibleSegments[activeIndex].chunkIndex}-${visibleSegments[activeIndex].segmentIndex}`
      : visibleSegments.length > 0
      ? `${visibleSegments[visibleSegments.length - 1].chunkIndex}-${
          visibleSegments[visibleSegments.length - 1].segmentIndex
        }`
      : null;

  // Detect manual scrolling and track near-bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 64;
      const nearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - threshold;
      setIsNearBottom(nearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    // Initialize near-bottom on mount
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-follow: only when near bottom and active segment changed; scroll only if out of view
  useEffect(() => {
    if (!isNearBottom || !activeKey) return;

    const container = scrollContainerRef.current;
    const target = activeSegmentRef.current || lastSegmentRef.current;
    if (!container || !target) return;

    if (prevActiveKeyRef.current === activeKey) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const topPad = 8;
    const bottomPad = 8;
    const outOfView =
      targetRect.top < containerRect.top + topPad ||
      targetRect.bottom > containerRect.bottom - bottomPad;

    if (outOfView) {
      const offsetWithinContainer = targetRect.top - containerRect.top;
      const desiredTop = Math.max(
        0,
        container.scrollTop +
          offsetWithinContainer -
          container.clientHeight * 0.3
      );
      container.scrollTo({ top: desiredTop, behavior: "smooth" });
    }

    prevActiveKeyRef.current = activeKey;
  }, [activeKey, isNearBottom]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    setSelectedText(text);
  };

  const handleResearch = () => {
    if (!selectedText || !onTextSelected) return;
    onTextSelected(selectedText);
    setSelectedText(""); // Clear selection after submitting
  };

  // Utility function to format seconds to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (chunks.length === 0 && !isTranscribing && !error) {
    return null;
  }

  return (
    <div>
      <Separator className='my-4' />

      <div className='flex items-center justify-between mb-3'>
        <h3 className='font-medium text-sm'>Transcript</h3>
        {isTranscribing && <Badge variant='secondary'>Transcribing...</Badge>}
        {visibleSegments.length > 0 && !isTranscribing && (
          <Badge variant='outline'>{visibleSegments.length} segments</Badge>
        )}
      </div>

      {error && (
        <div className='text-sm text-destructive mb-3'>
          Transcription error: {error}
        </div>
      )}

      {selectedText && (
        <div className='mb-3 flex items-center gap-2'>
          <Button size='sm' onClick={handleResearch}>
            Research Selected
          </Button>
          <span className='text-xs text-muted-foreground truncate'>
            &quot;{selectedText.substring(0, 50)}
            {selectedText.length > 50 ? "..." : ""}&quot;
          </span>
        </div>
      )}

      {visibleSegments.length > 0 && (
        <div className='relative'>
          <div
            ref={scrollContainerRef}
            onMouseUp={handleTextSelection}
            className='h-[600px] rounded-md border p-4 overflow-y-auto'
          >
            {visibleSegments.map((item, index) => {
              const key = `${item.chunkIndex}-${item.segmentIndex}`;
              const isLast = index === visibleSegments.length - 1;
              const isActive = item.isActive;
              return (
                <div
                  key={key}
                  ref={
                    isActive
                      ? (node) => {
                          if (node) activeSegmentRef.current = node;
                          if (isLast)
                            lastSegmentRef.current = node as HTMLDivElement;
                        }
                      : isLast
                      ? lastSegmentRef
                      : undefined
                  }
                  className={`text-sm mb-2 p-0 rounded ${
                    isActive
                      ? "bg-accent border-l-4 border-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className='text-xs font-mono'>
                    [{formatTime(item.absoluteStartTime)} -{" "}
                    {formatTime(item.absoluteEndTime)}]
                  </span>{" "}
                  {item.segment.text}
                </div>
              );
            })}
          </div>

          {!isNearBottom && (
            <div className='absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none'>
              <Button
                size='sm'
                onClick={() => {
                  const container = scrollContainerRef.current;
                  const target =
                    activeSegmentRef.current || lastSegmentRef.current;
                  if (!container || !target) return;
                  const containerRect = container.getBoundingClientRect();
                  const targetRect = target.getBoundingClientRect();
                  const offsetWithinContainer =
                    targetRect.top - containerRect.top;
                  const desiredTop = Math.max(
                    0,
                    container.scrollTop +
                      offsetWithinContainer -
                      container.clientHeight * 0.3
                  );
                  container.scrollTo({ top: desiredTop, behavior: "smooth" });
                  setIsNearBottom(true);
                }}
                className='pointer-events-auto shadow-lg'
              >
                Jump to live
              </Button>
            </div>
          )}
        </div>
      )}

      {chunks.length > 0 && visibleSegments.length === 0 && !isTranscribing && (
        <div className='border rounded-md p-4 text-center text-sm text-muted-foreground'>
          Transcript will appear as audio plays...
        </div>
      )}
    </div>
  );
}
