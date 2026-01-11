import React, { useEffect, useState } from "react";

type McpStatus = {
  port: number | null;
  sseUrl: string | null;
  currentProjectId: string | null;
  hasAuthToken: boolean;
  isConfigured: boolean;
};

interface McpDiagnosticsProps {
  isAdmin: boolean;
}

export const McpDiagnostics: React.FC<McpDiagnosticsProps> = ({ isAdmin }) => {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setError(null);
      if (typeof window === "undefined") return;
      // @ts-ignore - electronAPI is injected via preload
      const api = window.electronAPI;
      if (!api?.platform?.isDesktop || !api?.mcp?.getStatus) {
        setStatus(null);
        return;
      }
      const data = await api.mcp.getStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-500">monitoring</span>
          MCP diagnostika
          <span className="ml-2 px-2.5 py-1 bg-slate-500/15 text-slate-500 text-xs font-bold rounded-lg border border-slate-500/30">
            Admin
          </span>
        </h2>
        <button
          onClick={loadStatus}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/20 transition-colors"
        >
          Obnovit
        </button>
      </div>

      {!status && !error && (
        <div className="mt-4 text-sm text-slate-500">
          MCP status je dostupny jen v desktop aplikaci.
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-rose-600 dark:text-rose-300">
          Chyba: {error}
        </div>
      )}

      {status && (
        <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <span>Stav konfigurace</span>
            <span className={status.isConfigured ? "text-emerald-600" : "text-amber-600"}>
              {status.isConfigured ? "Pripraveno" : "Chybi token nebo env"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Token prihlaseneho uzivatele</span>
            <span className={status.hasAuthToken ? "text-emerald-600" : "text-amber-600"}>
              {status.hasAuthToken ? "Nastaven" : "Nenastaven"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Aktualni projekt</span>
            <span className="font-mono text-xs">{status.currentProjectId || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Port</span>
            <span className="font-mono text-xs">{status.port ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>SSE URL</span>
            <span className="font-mono text-xs truncate max-w-[60%]">{status.sseUrl ?? "-"}</span>
          </div>
        </div>
      )}
    </section>
  );
};
