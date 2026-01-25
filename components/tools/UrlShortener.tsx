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
    <div className="max-w-6xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Section: Header & Stats */}
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">link</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Zkracovač URL
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Krátké a přehledné odkazy pro vaše projekty
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:w-80">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
            <div className="text-xl font-black text-primary">
              {stats.totalLinks}
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
              Odkazů
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
            <div className="text-xl font-black text-emerald-500">
              {stats.totalClicks}
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
              Kliknutí
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Create Form - Sidebar-like on large screens */}
        <div className="lg:col-span-4 space-y-5">
          <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">
              Vytvořit nový odkaz
            </h2>
            <form onSubmit={handleShorten} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                  Cílová URL adresa
                </label>
                <input
                  type="url"
                  value={longUrl}
                  onChange={(e) => setLongUrl(e.target.value)}
                  placeholder="Vložte dlouhý odkaz..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none text-sm text-slate-900 dark:text-white transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                  Vlastní alias <span className="text-[9px] opacity-50 lowercase font-normal">(volitelné)</span>
                </label>
                <div className="flex items-center gap-2 group">
                  <span className="text-xs text-slate-400 font-black px-2 shadow-sm rounded-lg bg-slate-100 dark:bg-slate-800 py-2.5">
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
                    placeholder="muj-alias"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none text-xs font-black text-slate-900 dark:text-white tracking-wide transition-all"
                    maxLength={20}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !longUrl}
                className="w-full bg-primary hover:brightness-110 disabled:opacity-50 text-white text-xs font-black py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20 mt-2 uppercase tracking-widest"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    Zkrátit hned
                  </>
                )}
              </button>
            </form>

            {(error || successMessage) && (
              <div className={`mt-4 p-3 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${error
                ? "bg-red-500/5 border-red-500/20 text-red-500"
                : "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                }`}>
                <span className="material-symbols-outlined text-sm">
                  {error ? "error" : "check_circle"}
                </span>
                {error || successMessage}
              </div>
            )}
          </section>
        </div>

        {/* Link History - Main area */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">history</span>
                Historie odkazů
              </h2>
            </div>

            <div className="flex-1 overflow-auto max-h-[600px] divide-y divide-slate-50 dark:divide-slate-800">
              {isLoadingLinks ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Načítám links...</span>
                </div>
              ) : links.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-2xl opacity-20">link_off</span>
                  </div>
                  <p className="text-xs font-bold">Zatím jste nic nezkrátili.</p>
                </div>
              ) : (
                links.map((link) => (
                  <div
                    key={link.id}
                    className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-black text-primary tracking-tight">
                            {link.shortUrl}
                          </span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                            {formatDate(link.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate opacity-70 group-hover:opacity-100 transition-opacity">
                          → {truncateUrl(link.originalUrl, 60)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex flex-col items-end mr-2 px-3 border-r border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                            {link.clicks}
                          </span>
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Kliků</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(link.shortUrl, link.id)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${copiedId === link.id
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary"
                              }`}
                            title="Kopírovat"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {copiedId === link.id ? "check" : "content_copy"}
                            </span>
                          </button>

                          <button
                            onClick={() => handleDelete(link.id)}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
                            title="Smazat"
                          >
                            <span className="material-symbols-outlined text-sm">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
