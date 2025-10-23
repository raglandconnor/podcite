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
  rssUrl,
  totalEpisodes,
}: PodcastInfoProps) {
  return (
    <div className='bg-card p-6 rounded-lg shadow border'>
      <h2 className='text-xl font-semibold mb-4 text-card-foreground'>
        Podcast
      </h2>
      <div className='flex gap-4'>
        {imageUrl && (
          <img
            src={imageUrl}
            alt='Podcast cover'
            className='w-24 h-24 rounded-lg object-cover'
          />
        )}
        <div>
          <h3 className='font-semibold text-lg text-card-foreground'>
            {title}
          </h3>
          <p className='text-muted-foreground mt-2'>{description}</p>
          <p className='text-sm text-muted-foreground mt-2'>
            Total episodes: {totalEpisodes}
          </p>
        </div>
      </div>
    </div>
  );
}
