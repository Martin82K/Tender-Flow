import React, { useState } from "react";
import { shortenUrl } from "../../services/urlShortenerService";

/**
 * Solo URL Shortener Component
 * Can be used anywhere to generate short URLs.
 */
export const UrlShortener: React.FC = () => {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShortUrl(null);
    setIsLoading(true);

    if (!longUrl.trim()) {
      setError("Prosím zadejte URL adresu");
      setIsLoading(false);
      return;
    }

    const result = await shortenUrl(longUrl);

    if (result.success && result.shortUrl) {
      setShortUrl(result.shortUrl);
    } else {
      setError(result.error || "Něco se pokazilo při zkracování URL");
    }
    setIsLoading(false);
  };

  const handleCopy = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      console.error("Failed to copy");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm max-w-md w-full">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-emerald-500">link</span>
        Zkracovač URL
      </h3>

      <form onSubmit={handleShorten} className="space-y-4">
        <div>
          <input
            type="url"
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
            placeholder="Vložte dlouhou URL adresu https://..."
            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-900 dark:text-white transition-all"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !longUrl}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">
                progress_activity
              </span>
              Zkracuji...
            </>
          ) : (
            "Zkrátit odkaz"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      {shortUrl && (
        <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
          <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 block">
            Váš zkrácený odkaz
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-700 dark:text-emerald-300 font-mono text-sm truncate">
              {shortUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`p-2 rounded-lg transition-all ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
              }`}
              title="Zkopírovat"
            >
              <span className="material-symbols-outlined text-xl">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-right">
              Zkopírováno do schránky!
            </p>
          )}
        </div>
      )}
    </div>
  );
};
