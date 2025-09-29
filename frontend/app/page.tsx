"use client";

import { useState } from "react";

interface PodcastData {
  podcast: {
    title: string;
    description: string;
    image_url: string;
    rss_url: string;
  };
  episode: {
    title: string;
    description: string;
    audio_url: string;
    published_date: string;
    duration: string;
    episode_index: number;
  };
  total_episodes_in_feed: number;
  audio_download: {
    status: string;
    file_path: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    error: string | null;
  };
}

export default function Home() {
  const [rssUrl, setRssUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PodcastData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseRSS = async () => {
    if (!rssUrl) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/podcasts/parse-rss?url=${encodeURIComponent(
          rssUrl
        )}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse RSS feed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    parseRSS();
  };

  return (
    <div className='min-h-screen p-8 bg-gray-50'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-3xl font-bold text-gray-900 mb-8'>
          Podcast RSS Parser
        </h1>

        <form onSubmit={handleSubmit} className='mb-8'>
          <div className='flex gap-4'>
            <input
              type='url'
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder='Enter RSS feed URL (e.g., https://feeds.megaphone.fm/GLT1412515089)'
              className='flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              disabled={loading}
            />
            <button
              type='submit'
              disabled={loading || !rssUrl}
              className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
            >
              {loading ? "Parsing..." : "Parse RSS"}
            </button>
          </div>
        </form>

        {error && (
          <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md'>
            Error: {error}
          </div>
        )}

        {data && (
          <div className='space-y-6'>
            {/* Podcast Info */}
            <div className='bg-white p-6 rounded-lg shadow'>
              <h2 className='text-xl font-semibold mb-4'>Podcast</h2>
              <div className='flex gap-4'>
                {data.podcast.image_url && (
                  <img
                    src={data.podcast.image_url}
                    alt='Podcast cover'
                    className='w-24 h-24 rounded-lg object-cover'
                  />
                )}
                <div>
                  <h3 className='font-semibold text-lg'>
                    {data.podcast.title}
                  </h3>
                  <p className='text-gray-600 mt-2'>
                    {data.podcast.description}
                  </p>
                  <p className='text-sm text-gray-500 mt-2'>
                    Total episodes: {data.total_episodes_in_feed}
                  </p>
                </div>
              </div>
            </div>

            {/* Episode Info */}
            <div className='bg-white p-6 rounded-lg shadow'>
              <h2 className='text-xl font-semibold mb-4'>Latest Episode</h2>
              <h3 className='font-semibold text-lg'>{data.episode.title}</h3>
              <p className='text-gray-600 mt-2'>{data.episode.description}</p>
              <div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='font-medium'>Published:</span>{" "}
                  {data.episode.published_date}
                </div>
                <div>
                  <span className='font-medium'>Duration:</span>{" "}
                  {Math.floor(parseInt(data.episode.duration) / 60)} minutes
                </div>
              </div>

              {/* Audio Player */}
              {data.audio_download.status === "success" &&
                data.audio_download.filename && (
                  <div className='mt-6'>
                    <h3 className='font-medium mb-3'>Listen to Episode</h3>
                    <audio controls className='w-full' preload='metadata'>
                      <source
                        src={`http://localhost:8000/media/${data.audio_download.filename}`}
                        type={data.audio_download.content_type}
                      />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
