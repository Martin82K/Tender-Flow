import React, { useEffect, useState } from "react";
import { getOriginalUrl, normalizeSafeShortRedirectUrl } from "../../services/urlShortenerService";
import { summarizeErrorForLog } from "@/shared/security/logSanitizer";

interface ShortUrlRedirectProps {
  code: string;
}

type RedirectState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "external"; url: string; hostname: string };

export const ShortUrlRedirect: React.FC<ShortUrlRedirectProps> = ({ code }) => {
  const [redirectState, setRedirectState] = useState<RedirectState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    const resolveUrl = async () => {
      if (!code) {
        setRedirectState({ status: "error", message: "Neplatný odkaz" });
        return;
      }

      const { url, error: fetchError } = await getOriginalUrl(code);
      if (!isMounted) return;

      if (url) {
        const safeUrl = normalizeSafeShortRedirectUrl(url);
        if (!safeUrl) {
          setRedirectState({
            status: "error",
            message: "Odkaz je neplatný nebo blokovaný z bezpečnostních důvodů.",
          });
          return;
        }

        const target = new URL(safeUrl);
        if (target.origin === window.location.origin) {
          window.location.assign(safeUrl);
          return;
        }

        setRedirectState({ status: "external", url: safeUrl, hostname: target.hostname });
      } else {
        setRedirectState({ status: "error", message: "Odkaz nebyl nalezen nebo vypršel." });
        if (fetchError) console.error("URL resolution error:", summarizeErrorForLog(fetchError));
      }
    };

    resolveUrl();

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (redirectState.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <span className="material-symbols-outlined text-6xl text-red-500 mb-4">
          link_off
        </span>
        <h1 className="text-2xl font-bold mb-2">Chyba přesměrování</h1>
        <p className="text-slate-400 max-w-md text-center">{redirectState.message}</p>
        <a
          href="/"
          className="mt-8 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          Přejít na domovskou stránku
        </a>
      </div>
    );
  }

  if (redirectState.status === "external") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <span className="material-symbols-outlined text-6xl text-amber-300 mb-4">
          open_in_new
        </span>
        <h1 className="text-2xl font-bold mb-2">Pokračovat mimo Tender Flow</h1>
        <p className="text-slate-400 max-w-md text-center">Cílová doména: {redirectState.hostname}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href={redirectState.url}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-center"
          >
            Pokračovat
          </a>
          <a
            href="/"
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center"
          >
            Zrušit
          </a>
        </div>
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
