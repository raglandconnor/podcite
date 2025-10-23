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
  currentTime: number;
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
      currentTime,
    },
    ref
  ) => {
    return (
      <div className='bg-card p-6 rounded-lg shadow border'>
        <h2 className='text-xl font-semibold mb-4 text-card-foreground'>
          Latest Episode
        </h2>
        <h3 className='font-semibold text-lg text-card-foreground'>{title}</h3>
        <p className='text-muted-foreground mt-2'>{description}</p>
        <div className='mt-4 grid grid-cols-2 gap-4 text-sm text-card-foreground'>
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
            onPlay={onAudioPlay}
          />
        )}

        {/* Transcription Display */}
        <TranscriptionDisplay
          chunks={transcription.chunks}
          isTranscribing={transcription.isTranscribing}
          error={transcription.error}
          currentTime={currentTime}
        />
      </div>
    );
  }
);

EpisodeInfo.displayName = "EpisodeInfo";

export default EpisodeInfo;
