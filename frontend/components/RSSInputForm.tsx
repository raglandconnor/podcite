interface RSSInputFormProps {
  rssUrl: string;
  onRssUrlChange: (url: string) => void;
  onParse: () => void;
  loading: boolean;
}

export default function RSSInputForm({
  rssUrl,
  onRssUrlChange,
  onParse,
  loading,
}: RSSInputFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onParse();
  };

  return (
    <form onSubmit={handleSubmit} className='mb-8'>
      <div className='flex gap-4'>
        <input
          type='url'
          value={rssUrl}
          onChange={(e) => onRssUrlChange(e.target.value)}
          placeholder='Enter RSS feed URL (e.g., https://feeds.megaphone.fm/GLT1412515089)'
          className='flex-1 px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-transparent text-foreground placeholder:text-muted-foreground'
          disabled={loading}
        />
        <button
          type='submit'
          disabled={loading || !rssUrl}
          className='px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground'
        >
          {loading ? "Parsing..." : "Parse RSS"}
        </button>
      </div>
    </form>
  );
}
