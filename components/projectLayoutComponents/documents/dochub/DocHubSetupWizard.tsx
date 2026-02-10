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
              className={`p-3 rounded-xl border text-left transition-all ${provider === "gdrive"
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
              className={`p-3 rounded-xl border text-left transition-all ${provider === "onedrive"
                ? "bg-violet-500/15 border-violet-500/40"
                : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
                }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Tender Flow Desktop
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Lokální složka
              </div>
            </button>

            <button
              type="button"
              onClick={() => setters.setProvider("mcp")}
              className={`p-3 rounded-xl border text-left transition-all ${provider === "mcp"
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
          <div className="text-[11px] text-slate-500 flex justify-between items-center">
            <span>
              {isMcpProvider
                ? "MCP Bridge Server umožňuje automatické vytváření složek na vašem disku."
                : "Google: OAuth + Picker. Tender Flow Desktop: vyberte složku z disku."}
            </span>
            {isConnectedStatus && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Připojeno
              </span>
            )}
          </div>
        </div>



        <div className={`space-y-2 border rounded-xl p-4 transition-all ${isConnectedStatus && !rootLink
          ? "bg-violet-50 dark:bg-violet-900/10 border-violet-500ring-1 ring-violet-500/20"
          : "bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/50"
          }`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2) Hlavní složka projektu
            </div>
            {isConnectedStatus && !rootLink && (
              <div className="text-xs font-bold text-violet-600 animate-pulse">
                &larr; Pokračujte zde
              </div>
            )}
          </div>
          <div className="space-y-2">
            {/* Manual Link Entry (Primary for Google Drive) */}
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                <p className="font-semibold mb-1">Jak vybrat složku:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Otevřete požadovanou složku v Google Drive (v prohlížeči).</li>
                  <li>Zkopírujte celou adresu (URL) z řádku prohlížeče.</li>
                  <li>Vložte ji do pole níže a klikněte na "Získat odkaz".</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={rootLink}
                  onChange={(e) => setters.setRootLink(e.target.value)}
                  placeholder={
                    isMcpProvider
                      ? "Cesta ke složce (např. /Users/jmeno/Documents/Projekty)"
                      : isLocalProvider
                        ? "Cesta ke složce (např. C:\\Projekty\\Stavba)"
                        : "Vložte URL složky z Google Drive (https://drive.google.com/...)"
                  }
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                />
                {(isConnectedStatus && rootLink === state.rootLink) || !isConnectedStatus ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isConnectedStatus && rootLink === state.rootLink) {
                        actions.openRoot();
                      } else {
                        actions.resolveRoot();
                      }
                    }}
                    disabled={isConnecting || (!isConnectedStatus && !provider) || !rootLink.trim()}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${isConnecting || (!isConnectedStatus && !provider) || !rootLink.trim()
                      ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                      : isConnectedStatus && rootLink === state.rootLink
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow-lg shadow-emerald-500/20"
                        : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                      }`}
                  >
                    {isConnecting
                      ? "Ověřuji..."
                      : isConnectedStatus && rootLink === state.rootLink
                        ? <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">folder_open</span>Otevřít složku</span>
                        : isLocalProvider || isMcpProvider
                          ? "Připojit složku"
                          : "Použít tuto složku"
                    }
                  </button>
                ) : null}
              </div>
            </div>

            {/* Create New Folder (Secondary) */}
            {provider === "gdrive" && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Nebo vytvořit novou</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setters.setNewFolderName(e.target.value)}
                    placeholder="Název nové složky"
                    className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={actions.createGoogleRoot}
                    disabled={
                      isConnecting || !isConnectedStatus || !newFolderName.trim()
                    }
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${isConnecting || !isConnectedStatus || !newFolderName.trim()
                      ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                      : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                      }`}
                  >
                    Vytvořit novou
                  </button>
                </div>
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              {isMcpProvider
                ? "Zadejte absolutní cestu ke složce. MCP Bridge server musí běžet."
                : isLocalProvider
                  ? "Zadejte cestu ke složce nebo použijte tlačítko výše."
                  : "Google: doporučeno vybrat přes Picker. Tender Flow Desktop: vyberte lokální složku."}
            </div>

            {/* Success Feedback for MCP */}
            {isConnectedStatus && isMcpProvider && (
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">check_circle</span>
                <div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Úspěšně připojeno</div>
                  <div className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-1">
                    Složka je ověřena. Nyní můžete v přehledu dokumentů kliknout na <b>Synchronizovat</b> pro vytvoření struktury.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isConnectedStatus) {
                if (window.confirm("Opravdu chcete odpojit tuto složku od projektu?")) {
                  actions.disconnect();
                }
              } else {
                if (isLocalProvider) actions.resolveRoot();
                else if (isMcpProvider) actions.connectMcp();
                else actions.connect();
              }
            }}
            disabled={
              isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !isMcpProvider && !mode)))
            }
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !isMcpProvider && !mode)))
              ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
              : isConnectedStatus
                ? "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 border-slate-300 dark:border-slate-700/50"
                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
              }`}
            title={
              isConnectedStatus
                ? "Odpojí Složkomat účet pro tuto stavbu"
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
                    : `Připojit přes ${provider === "gdrive" ? "Google" : "Microsoft"
                    }`}
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
