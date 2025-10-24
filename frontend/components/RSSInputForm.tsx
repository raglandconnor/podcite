import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        <Input
          type='url'
          value={rssUrl}
          onChange={(e) => onRssUrlChange(e.target.value)}
          placeholder='Enter RSS feed URL (e.g., https://feeds.megaphone.fm/GLT1412515089)'
          disabled={loading}
          className='flex-1'
        />
        <Button type='submit' disabled={loading || !rssUrl}>
          {loading ? "Parsing..." : "Parse RSS"}
        </Button>
      </div>
    </form>
  );
}
