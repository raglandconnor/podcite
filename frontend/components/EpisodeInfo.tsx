import { forwardRef } from "react";
import AudioPlayer from "./AudioPlayer";
import TranscriptionDisplay from "./TranscriptionDisplay";

interface TranscriptionChunk {
  chunk_index: number;
  total_chunks: number;
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  time_offset: number;
  error?: string;
}

interface EpisodeInfoProps {
  title: string;
  description: string;
  publishedDate: string;
  duration: string;
  audioDownload: {
    status: string;
    filename: string;
    contentType: string;
  };
  transcription: {
    chunks: TranscriptionChunk[];
    isTranscribing: boolean;
    error: string | null;
  };
  onAudioPlay: () => void;
}

const EpisodeInfo = forwardRef<HTMLAudioElement, EpisodeInfoProps>(
  (
    {
      title,
      description,
      publishedDate,
      duration,
      audioDownload,
      transcription,
      onAudioPlay,
    },
    ref
  ) => {
    return (
      <div className='bg-white p-6 rounded-lg shadow'>
        <h2 className='text-xl font-semibold mb-4'>Latest Episode</h2>
        <h3 className='font-semibold text-lg'>{title}</h3>
        <p className='text-gray-600 mt-2'>{description}</p>
        <div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='font-medium'>Published:</span> {publishedDate}
          </div>
          <div>
            <span className='font-medium'>Duration:</span>{" "}
            {Math.floor(parseInt(duration) / 60)} minutes
          </div>
        </div>

        {/* Audio Player */}
        {audioDownload.status === "success" && audioDownload.filename && (
          <AudioPlayer
            ref={ref}
            filename={audioDownload.filename}
            contentType={audioDownload.contentType}
            isTranscribing={transcription.isTranscribing}
            transcriptionCompleted={false}
            transcriptionChunksLength={transcription.chunks.length}
            onPlay={onAudioPlay}
          />
        )}

        {/* Transcription Display */}
        <TranscriptionDisplay
          chunks={transcription.chunks}
          isTranscribing={transcription.isTranscribing}
          error={transcription.error}
        />
      </div>
    );
  }
);

EpisodeInfo.displayName = "EpisodeInfo";

export default EpisodeInfo;
