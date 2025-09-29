import { forwardRef } from "react";

interface AudioPlayerProps {
  filename: string;
  contentType: string;
  isTranscribing: boolean;
  transcriptionCompleted: boolean;
  transcriptionChunksLength: number;
  onPlay: () => void;
}

const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  (
    {
      filename,
      contentType,
      isTranscribing,
      transcriptionCompleted,
      transcriptionChunksLength,
      onPlay,
    },
    ref
  ) => {
    return (
      <div className='mt-6'>
        <h3 className='font-medium mb-3'>Listen to Episode</h3>
        <audio
          ref={ref}
          controls
          className='w-full'
          preload='metadata'
          onPlay={onPlay}
        >
          <source
            src={`http://localhost:8000/media/${filename}`}
            type={contentType}
          />
          Your browser does not support the audio element.
        </audio>

        {isTranscribing && (
          <div className='mt-2 text-sm text-blue-600'>
            Transcribing... ({transcriptionChunksLength} chunks processed)
          </div>
        )}
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
