import { forwardRef } from "react";

interface AudioPlayerProps {
  filename: string;
  contentType: string;
  onPlay: () => void;
}

const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  ({ filename, contentType, onPlay }, ref) => {
    return (
      <div>
        <h3 className='font-medium mb-3 text-sm'>Listen to Episode</h3>
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
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
