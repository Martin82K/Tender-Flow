import React, { useState, useEffect, useCallback } from "react";
import {
  shortenUrlWithAlias,
  getUserLinks,
  getUserLinkStats,
  deleteShortUrl,
  UserLink,
  UserLinkStats,
} from "../../services/urlShortenerService";

/**
 * URL Shortener Tool - Full Featured Component
 * Inspired by LinkSwift design
 */
export const UrlShortener: React.FC = () => {
  // Form state
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data state
  const [links, setLinks] = useState<UserLink[]>([]);
  const [stats, setStats] = useState<UserLinkStats>({
    totalLinks: 0,
    totalClicks: 0,
  });
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load user links and stats
  const loadData = useCallback(async () => {
    setIsLoadingLinks(true);
    const [linksResult, statsResult] = await Promise.all([
      getUserLinks(),
      getUserLinkStats(),
    ]);
    setLinks(linksResult.links);
    setStats(statsResult);
    setIsLoadingLinks(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle form submission
  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (!longUrl.trim()) {
      setError("Prosím zadejte URL adresu");
      setIsLoading(false);
      return;
    }

    const result = await shortenUrlWithAlias(longUrl, customAlias || undefined);

    if (result.success && result.shortUrl) {
      setSuccessMessage(`Odkaz vytvořen: ${result.shortUrl}`);
      setLongUrl("");
      setCustomAlias("");
      loadData(); // Refresh the list
    } else {
      setError(result.error || "Něco se pokazilo při zkracování URL");
    }
    setIsLoading(false);
  };

  // Handle copy to clipboard
  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  // Handle delete
  const handleDelete = async (code: string) => {
    const result = await deleteShortUrl(code);
    if (result.success) {
      loadData();
    } else {
      setError(result.error || "Nepodařilo se smazat odkaz");
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Truncate URL for display
  const truncateUrl = (url: string, maxLen = 40) => {
    return url.length > maxLen ? url.substring(0, maxLen) + "..." : url;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-blue-500">
              link
            </span>
            Zkracovač URL
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Vytvářejte krátké odkazy a sledujte jejich statistiky
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalLinks}
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-300 uppercase font-semibold">
              Odkazů
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.totalClicks}
            </div>
            <div className="text-xs text-emerald-500 dark:text-emerald-300 uppercase font-semibold">
              Kliknutí
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-6 mb-8">
        <form onSubmit={handleShorten} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Dlouhá URL adresa
            </label>
            <input
              type="url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              placeholder="https://example.com/very/long/url/that/needs/shortening"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 dark:text-white transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Vlastní alias <span className="text-slate-400">(volitelné)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-sm">
                /s/
              </span>
              <input
                type="text"
                value={customAlias}
                onChange={(e) =>
                  setCustomAlias(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                  )
                }
                placeholder="muj-odkaz"
                className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-mono transition-all"
                maxLength={20}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              3-20 znaků, pouze písmena, čísla, pomlčky a podtržítka
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !longUrl}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-xl">
                  progress_activity
                </span>
                Vytvářím...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">add_link</span>
                Zkrátit hned
              </>
            )}
          </button>
        </form>

        {/* Success/Error Messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            {successMessage}
          </div>
        )}
      </div>

      {/* Link History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400">
              history
            </span>
            Moje odkazy
          </h2>
        </div>

        {isLoadingLinks ? (
          <div className="p-8 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">
              progress_activity
            </span>
          </div>
        ) : links.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              link_off
            </span>
            Zatím žádné odkazy
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {links.map((link) => (
              <div
                key={link.id}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-blue-600 dark:text-blue-400 font-medium truncate">
                      {link.shortUrl}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                      → {truncateUrl(link.originalUrl)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {link.clicks}
                      </span>{" "}
                      kliků
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDate(link.createdAt)}
                    </div>

                    <button
                      onClick={() => handleCopy(link.shortUrl, link.id)}
                      className={`p-2 rounded-lg transition-all ${
                        copiedId === link.id
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                      title="Kopírovat"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {copiedId === link.id ? "check" : "content_copy"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                      title="Smazat"
                    >
                      <span className="material-symbols-outlined text-lg">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
