import { useState, useCallback } from "react";

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
  } catch {
    // not a valid URL
  }
  return null;
}

function extractTwitchChannel(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("twitch.tv")) {
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] ?? null;
    }
  } catch {
    // not a valid URL
  }
  return null;
}

export function PodcastPlayer() {
  const [urlInput, setUrlInput] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = urlInput.trim();
      if (!trimmed) return;

      // YouTube
      const ytId = extractYouTubeId(trimmed);
      if (ytId) {
        setEmbedUrl(`https://www.youtube.com/embed/${ytId}?autoplay=1`);
        return;
      }

      // Twitch
      const twitchChannel = extractTwitchChannel(trimmed);
      if (twitchChannel) {
        setEmbedUrl(
          `https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}`
        );
        return;
      }

      setError("Paste a YouTube or Twitch URL to embed the stream.");
    },
    [urlInput]
  );

  const handleClear = useCallback(() => {
    setEmbedUrl(null);
    setUrlInput("");
    setError(null);
  }, []);

  if (embedUrl) {
    return (
      <div className="relative flex-1 overflow-hidden rounded-xl border border-gray-800">
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Podcast stream"
        />
        <button
          onClick={handleClear}
          className="absolute right-3 top-3 rounded-lg bg-gray-900/80 px-3 py-1.5 text-xs font-medium text-gray-300 backdrop-blur-sm transition-colors hover:bg-gray-800 hover:text-white"
        >
          Change Stream
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/30 p-8">
      <div className="mb-4 text-4xl text-gray-600">&#9654;</div>
      <h3 className="mb-2 text-lg font-semibold text-gray-300">
        Load a Live Stream
      </h3>
      <p className="mb-6 max-w-sm text-center text-sm text-gray-500">
        Paste a YouTube or Twitch URL to embed the stream. AIDAIS will listen
        via your microphone and provide real-time AI commentary.
      </p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-lg gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Load
        </button>
      </form>
      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
