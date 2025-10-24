import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stripHtmlTags } from "@/lib/utils";

interface PodcastInfoProps {
  title: string;
  description: string;
  imageUrl: string;
  rssUrl: string;
  totalEpisodes: number;
}

export default function PodcastInfo({
  title,
  description,
  imageUrl,
  totalEpisodes,
}: PodcastInfoProps) {
  const cleanDescription = stripHtmlTags(description);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Podcast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex gap-4'>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt='Podcast cover'
              className='w-24 h-24 rounded-sm object-cover'
            />
          )}
          <div className='flex-1'>
            <h3 className='font-semibold text-lg'>{title}</h3>
            <p className='text-muted-foreground mt-2 text-sm'>
              {cleanDescription}
            </p>
            <Badge variant='secondary' className='mt-2'>
              {totalEpisodes} episodes
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
