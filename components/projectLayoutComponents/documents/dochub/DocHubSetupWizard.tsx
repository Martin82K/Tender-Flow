import React from "react";
import { useDocHubIntegration } from "../../../../hooks/useDocHubIntegration";

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubSetupWizardProps {
  state: DocHubHook["state"];
  actions: DocHubHook["actions"];
  setters: DocHubHook["setters"];
  showModal: (args: {
    title: string;
    message: string;
    variant?: "danger" | "info" | "success";
  }) => void;
}

export const DocHubSetupWizard: React.FC<DocHubSetupWizardProps> = ({
  state,
  actions,
  setters,
  showModal,
}) => {
  const {
    provider,
    mode,
    rootName,
    rootLink,
    isConnecting,
    status,
    newFolderName,
    resolveProgress,
    isEditingSetup,
    isLocalProvider,
    isMcpProvider,
  } = state;

  // Derived state for local UI logic
  const isAuthed =
    status === "connected" || (state.enabled && !!state.rootLink); // Simplification, hook has robust 'isAuthed' but we need to match UI logic
  // Actually hook has 'isAuthed' in derived but not exported directly in 'state' object unless we put it there.
  // Let's use status check.
  const isConnectedStatus = status === "connected";

  return (
    <div className="bg-slate-100 dark:bg-slate-900/20 border border-slate-300 dark:border-slate-700/50 rounded-xl p-4">
      <div className="flex flex-col gap-4">
        {/* Step 1 */}
        <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            1) Provider
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setters.setProvider("gdrive")}
              className={`p-3 rounded-xl border text-left transition-all ${
                provider === "gdrive"
                  ? "bg-violet-500/15 border-violet-500/40"
                  : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Google Drive
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                My Drive / Shared
              </div>
            </button>
            <button
              type="button"
              onClick={() => setters.setProvider("onedrive")}
              className={`p-3 rounded-xl border text-left transition-all ${
                provider === "onedrive"
                  ? "bg-violet-500/15 border-violet-500/40"
                  : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                OneDrive
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Personal / Business
              </div>
            </button>
            <button
              type="button"
              onClick={() => setters.setProvider("local")}
              className={`p-3 rounded-xl border text-left transition-all ${
                provider === "local"
                  ? "bg-emerald-500/15 border-emerald-500/40"
                  : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Lokální disk
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Složka na PC
              </div>
            </button>
            <button
              type="button"
              onClick={() => setters.setProvider("mcp")}
              className={`p-3 rounded-xl border text-left transition-all ${
                provider === "mcp"
                  ? "bg-cyan-500/15 border-cyan-500/40"
                  : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                MCP Bridge
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Lokální server
              </div>
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            {isMcpProvider
              ? "MCP Bridge Server umožňuje automatické vytváření složek na vašem disku."
              : isLocalProvider
              ? "Lokální složka na vašem disku. Bez cloud synchronizace."
              : "Google: OAuth + Picker. OneDrive: zatím přes odkaz."}
          </div>
        </div>

        {/* Step 2 - hidden for local/mcp provider */}
        {!isLocalProvider && !isMcpProvider && (
          <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2) Režim
            </div>
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setters.setMode("user")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "user"
                    ? "bg-violet-600 text-white shadow-lg"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50"
                }`}
              >
                Můj účet
              </button>
              <button
                type="button"
                onClick={() => setters.setMode("org")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "org"
                    ? "bg-violet-600 text-white shadow-lg"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                Organizace
              </button>
            </div>
            <div className="text-[11px] text-slate-500">
              U Google je "Organizace" typicky Shared Drive.
            </div>
          </div>
        )}

        <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {isLocalProvider || isMcpProvider ? "2)" : "3)"} Hlavní složka
            projektu
          </div>
          <div className="space-y-2">
            {provider === "gdrive" && (
              <button
                type="button"
                onClick={actions.pickGoogleRoot}
                disabled={isConnecting || !isConnectedStatus}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isConnecting || !isConnectedStatus
                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                    : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                }`}
                title={
                  !isConnectedStatus
                    ? "Nejdřív připojte účet (OAuth)."
                    : "Otevře Google Picker pro výběr složky"
                }
              >
                {isConnecting
                  ? "Otevírám Picker..."
                  : "Vybrat složku z Google Drive"}
              </button>
            )}
            {provider === "gdrive" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setters.setNewFolderName(e.target.value)}
                  placeholder="Název nové složky"
                  className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={actions.createGoogleRoot}
                  disabled={
                    isConnecting || !isConnectedStatus || !newFolderName.trim()
                  }
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    isConnecting || !isConnectedStatus || !newFolderName.trim()
                      ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                      : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                  }`}
                  title={
                    !isConnectedStatus
                      ? "Nejdřív připojte účet (OAuth)."
                      : "Vytvoří složku v Google Drive a nastaví ji jako root projektu"
                  }
                >
                  Vytvořit
                </button>
              </div>
            )}
            {isLocalProvider && (
              <button
                type="button"
                onClick={actions.pickLocalFolder}
                disabled={isConnecting}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isConnecting
                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30"
                }`}
                title="Otevře systémový dialog pro výběr složky"
              >
                {isConnecting ? "Vybírám..." : "Vybrat složku z disku"}
              </button>
            )}
            {isMcpProvider && (
              <button
                type="button"
                onClick={actions.connectMcp}
                disabled={isConnecting || !rootLink.trim()}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isConnecting || !rootLink.trim()
                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/30"
                }`}
                title="Připojí se k MCP Bridge serveru a ověří složku"
              >
                {isConnecting ? "Připojuji..." : "Připojit přes MCP"}
              </button>
            )}
            <input
              type="text"
              value={rootName}
              onChange={(e) => setters.setRootName(e.target.value)}
              placeholder="Název (např. Stavba RD Novák)"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
            />
            <input
              type="text"
              value={rootLink}
              onChange={(e) => setters.setRootLink(e.target.value)}
              placeholder={
                isMcpProvider
                  ? "Cesta ke složce (např. /Users/jmeno/Documents/Projekty)"
                  : isLocalProvider
                  ? "Cesta ke složce (např. C:\\Projekty\\Stavba)"
                  : provider === "gdrive"
                  ? "Web URL složky (vyplní se po výběru) nebo vlož URL ručně"
                  : "Web URL (sdílený odkaz)"
              }
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
            />
            {!isLocalProvider && !isMcpProvider && (
              <button
                type="button"
                onClick={actions.resolveRoot}
                disabled={isConnecting || !provider || !rootLink.trim()}
                className={`relative overflow-hidden w-full px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  isConnecting || !provider || !rootLink.trim()
                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                }`}
                title="Získá odkaz přes Drive/Graph API a uloží rootId/rootWebUrl"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white/25"
                  style={{ width: `${resolveProgress}%` }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isConnecting ? "animate-spin" : ""
                    }`}
                  >
                    {isConnecting ? "sync" : "link"}
                  </span>
                  {isConnecting
                    ? `Získávám odkaz… ${resolveProgress}%`
                    : "Získat odkaz"}
                </span>
              </button>
            )}
            <div className="text-[11px] text-slate-500">
              {isMcpProvider
                ? "Zadejte absolutní cestu ke složce. MCP Bridge server musí běžet."
                : isLocalProvider
                ? "Zadejte cestu ke složce nebo použijte tlačítko výše."
                : "Google: doporučeno vybrat přes Picker. OneDrive: zatím vložte sdílený odkaz na složku."}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={
              isConnectedStatus
                ? actions.disconnect
                : isLocalProvider
                ? actions.saveSetup
                : isMcpProvider
                ? actions.connectMcp
                : actions.connect
            }
            disabled={
              isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !isMcpProvider && !mode)))
            }
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
              isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !isMcpProvider && !mode)))
                ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                : isConnectedStatus
                ? "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 border-slate-300 dark:border-slate-700/50"
                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
            }`}
            title={
              isConnectedStatus
                ? "Odpojí DocHub účet pro tuto stavbu"
                : isLocalProvider
                ? "Uloží nastavení lokální složky"
                : isMcpProvider
                ? "Připojí se k MCP Bridge serveru"
                : "Spustí OAuth autorizaci"
            }
          >
            {isConnecting
              ? "Pracuji..."
              : isConnectedStatus
              ? "Odpojit"
              : isLocalProvider
              ? "Připojit složku"
              : isMcpProvider
              ? "Připojit MCP"
              : `Připojit přes ${
                  provider === "gdrive" ? "Google" : "Microsoft"
                }`}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!provider || !mode || !rootLink.trim()) {
                showModal({
                  title: "DocHub",
                  message:
                    "Vyberte provider, režim a zadejte hlavní složku projektu (URL/cestu).",
                  variant: "info",
                });
                return;
              }
              actions.saveSetup();
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            Uložit nastavení
          </button>
        </div>
        {isConnectedStatus || isEditingSetup ? (
          <button
            type="button"
            onClick={() => setters.setIsEditingSetup(false)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700/50"
          >
            Zrušit
          </button>
        ) : null}
      </div>
    </div>
  );
};
