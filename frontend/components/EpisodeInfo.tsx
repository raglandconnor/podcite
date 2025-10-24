import { forwardRef } from "react";
import AudioPlayer from "./AudioPlayer";
import TranscriptionDisplay from "./TranscriptionDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { stripHtmlTags } from "@/lib/utils";

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
    const cleanDescription = stripHtmlTags(description);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest Episode</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <h3 className='font-semibold text-lg'>{title}</h3>
            <p className='text-muted-foreground mt-2 text-sm'>
              {cleanDescription}
            </p>
          </div>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='font-medium'>Published:</span>{" "}
              {new Date(publishedDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            {parseInt(duration) > 0 && (
              <div>
                <span className='font-medium'>Duration:</span>{" "}
                {Math.floor(parseInt(duration) / 60)} min
              </div>
            )}
          </div>

          {audioDownload.status === "success" && audioDownload.filename && (
            <>
              <Separator />
              <AudioPlayer
                ref={ref}
                filename={audioDownload.filename}
                contentType={audioDownload.contentType}
                onPlay={onAudioPlay}
              />
            </>
          )}

          <TranscriptionDisplay
            chunks={transcription.chunks}
            isTranscribing={transcription.isTranscribing}
            error={transcription.error}
            currentTime={currentTime}
          />
        </CardContent>
      </Card>
    );
  }
);

EpisodeInfo.displayName = "EpisodeInfo";

export default EpisodeInfo;
