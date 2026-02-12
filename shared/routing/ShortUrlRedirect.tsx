import React, { useEffect, useState } from "react";
import { getOriginalUrl } from "../../services/urlShortenerService";

interface ShortUrlRedirectProps {
  code: string;
}

export const ShortUrlRedirect: React.FC<ShortUrlRedirectProps> = ({ code }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveUrl = async () => {
      if (!code) {
        setError("Neplatný odkaz");
        return;
      }

      const { url, error: fetchError } = await getOriginalUrl(code);

      if (url) {
        // Redirect
        window.location.href = url;
      } else {
        setError("Odkaz nebyl nalezen nebo vypršel.");
        if (fetchError) console.error("URL resolution error:", fetchError);
      }
    };

    resolveUrl();
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <span className="material-symbols-outlined text-6xl text-red-500 mb-4">
          link_off
        </span>
        <h1 className="text-2xl font-bold mb-2">Chyba přesměrování</h1>
        <p className="text-slate-400 max-w-md text-center">{error}</p>
        <a
          href="/"
          className="mt-8 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          Přejít na domovskou stránku
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
      <p className="text-slate-400">Přesměrovávám...</p>
    </div>
  );
};
