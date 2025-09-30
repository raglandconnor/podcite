import { useRef, useEffect, useState } from "react";
import { researchStatements } from "@/lib/api";

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
}

export default function TranscriptionDisplay({
  chunks,
  isTranscribing,
  error,
  currentTime,
}: TranscriptionDisplayProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSegmentRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const prevActiveKeyRef = useRef<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [researchResults, setResearchResults] = useState<any>(null);
  const [isResearching, setIsResearching] = useState(false);

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

  const handleResearch = async () => {
    if (!selectedText) return;

    setIsResearching(true);
    setResearchResults(null);
    try {
      const results = await researchStatements([selectedText]);
      setResearchResults(results);
    } catch (error) {
      console.error("Research failed:", error);
      setResearchResults({ error: String(error) });
    } finally {
      setIsResearching(false);
    }
  };

  if (chunks.length === 0 && !isTranscribing && !error) {
    return null;
  }

  return (
    <div className='mt-6'>
      {isTranscribing && (
        <div className='text-sm text-blue-600 mb-2'>
          Transcribing... ({chunks.length} chunks processed)
        </div>
      )}

      {error && (
        <div className='text-sm text-red-600 mb-2'>
          Transcription error: {error}
        </div>
      )}

      {visibleSegments.length > 0 && (
        <div className='flex items-center justify-between mb-2'>
          <span className='text-sm text-gray-600'>
            Transcript ({visibleSegments.length} segments)
          </span>
        </div>
      )}

      {selectedText && (
        <div className='mb-2 flex items-center gap-2'>
          <button
            onClick={handleResearch}
            disabled={isResearching}
            className='bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400'
          >
            {isResearching ? "Researching..." : "Research Selected Text"}
          </button>
          <span className='text-xs text-gray-600'>
            "{selectedText.substring(0, 50)}
            {selectedText.length > 50 ? "..." : ""}"
          </span>
        </div>
      )}

      {researchResults && (
        <div className='mb-4 bg-white border border-gray-300 rounded-md p-4 max-h-96 overflow-auto'>
          <div className='flex justify-between items-center mb-2'>
            <h3 className='font-semibold text-sm'>Research Results</h3>
            <button
              onClick={() => setResearchResults(null)}
              className='text-gray-500 hover:text-gray-700 text-xs'
            >
              Close
            </button>
          </div>
          <pre className='text-xs whitespace-pre-wrap break-words'>
            {JSON.stringify(researchResults, null, 2)}
          </pre>
        </div>
      )}

      {visibleSegments.length > 0 && (
        <div
          ref={scrollContainerRef}
          onMouseUp={handleTextSelection}
          className='bg-gray-100 p-4 rounded-md max-h-64 overflow-y-auto relative'
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
                className={`text-sm mb-2 p-2 rounded ${
                  isActive
                    ? "bg-blue-100 border-l-4 border-blue-500"
                    : "text-gray-700"
                }`}
              >
                <div className='text-gray-500'>
                  [{item.absoluteStartTime.toFixed(0)}s -{" "}
                  {item.absoluteEndTime.toFixed(0)}s]
                  <span>{item.segment.text}</span>
                </div>
              </div>
            );
          })}

          {/* Jump to live when not following */}
          {!isNearBottom && (
            <div className='sticky bottom-0 left-0 flex justify-center pointer-events-none pt-4 bg-gradient-to-t from-gray-100 via-gray-100/80 to-transparent'>
              <button
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
                className='pointer-events-auto bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow hover:bg-blue-700'
                title='Jump to the current segment and resume following'
              >
                Jump to live
              </button>
            </div>
          )}
        </div>
      )}

      {chunks.length > 0 && visibleSegments.length === 0 && !isTranscribing && (
        <div className='bg-gray-100 p-4 rounded-md text-gray-500 text-center'>
          Transcript will appear as audio plays...
        </div>
      )}
    </div>
  );
}
