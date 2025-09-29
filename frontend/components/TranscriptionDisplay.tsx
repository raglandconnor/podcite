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
  time_offset: number;
  error?: string;
}

interface TranscriptionDisplayProps {
  chunks: TranscriptionChunk[];
  isTranscribing: boolean;
  error: string | null;
}

export default function TranscriptionDisplay({
  chunks,
  isTranscribing,
  error,
}: TranscriptionDisplayProps) {
  if (chunks.length === 0 && !isTranscribing && !error) {
    return null;
  }

  return (
    <div className='mt-6'>
      <h3 className='font-medium mb-3'>Live Transcription</h3>

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

      {chunks.length > 0 && (
        <div className='bg-gray-100 p-4 rounded-md max-h-96 overflow-y-auto'>
          {chunks.map((chunk, index) => (
            <div key={index} className='mb-4'>
              {chunk.segments.map((segment, segIndex) => (
                <div key={segIndex} className='text-xs text-gray-600 mt-1 ml-4'>
                  [{segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s]{" "}
                  {segment.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
