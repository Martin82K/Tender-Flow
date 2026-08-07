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
    rootLink,
    isConnecting,
    status,
    newFolderName,
    isEditingSetup,
    isLocalProvider,
    isSharedProject,
    canManageGlobal,
    hasPersonalLocalRoot,
    onlineRootLinkDraft,
  } = state;

  const isConnectedStatus = status === "connected";
  const shouldOpenCurrentRoot = isConnectedStatus &&
    rootLink.trim() !== "" &&
    (!isLocalProvider || hasPersonalLocalRoot);

  return (
    <div className="bg-slate-100 dark:bg-slate-900/20 border border-slate-300 dark:border-slate-700/50 rounded-xl p-4">
      <div className="flex flex-col gap-4">
        {isSharedProject && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-100">
            Globální napojení spravuje vlastník projektu. Zde si můžete nastavit pouze vlastní cestu k synchronizované složce; cesta vlastníka se na tomto zařízení nepoužije.
          </div>
        )}
        {/* Step 1 */}
        <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            1) Provider
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setters.setProvider("gdrive")}
              disabled={!canManageGlobal}
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
              disabled={!canManageGlobal}
              className={`p-3 rounded-xl border text-left transition-all ${provider === "onedrive"
                ? "bg-violet-500/15 border-violet-500/40"
                : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
                }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Tender Flow Desktop
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Lokální nebo síťový disk
              </div>
            </button>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between items-center">
            <span>
              Google: OAuth + Picker. Tender Flow Desktop: vyberte složku z disku.
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
            <div className="space-y-3">
              {isLocalProvider ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-semibold mb-1">Jak vybrat složku:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Klikněte na "Procházet" a vyberte složku z disku.</li>
                    <li>Nebo zadejte cestu ke složce ručně do pole níže.</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-semibold mb-1">Jak vybrat složku:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Otevřete požadovanou složku v Google Drive (v prohlížeči).</li>
                    <li>Zkopírujte celou adresu (URL) z řádku prohlížeče.</li>
                    <li>Vložte ji do pole níže a klikněte na "Získat odkaz".</li>
                  </ol>
                </div>
              )}

              {/* Local provider: Browse button */}
              {isLocalProvider && (
                <button
                  type="button"
                  onClick={actions.pickLocalFolder}
                  disabled={isConnecting}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-colors ${isConnecting
                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30 shadow-lg shadow-violet-500/20"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  Procházet
                </button>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={rootLink}
                  onChange={(e) => setters.setRootLink(e.target.value)}
                  disabled={isSharedProject && !isLocalProvider}
                  placeholder={
                    isLocalProvider
                      ? "Cesta ke složce (např. D:\\Projekty\\Stavba)"
                      : "Vložte URL složky z Google Drive (https://drive.google.com/...)"
                  }
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                />
                {shouldOpenCurrentRoot || !isConnectedStatus || isLocalProvider ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (shouldOpenCurrentRoot) {
                        actions.openRoot();
                      } else {
                        actions.resolveRoot();
                      }
                    }}
                    disabled={isConnecting || (!isConnectedStatus && !provider) || !rootLink.trim()}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${isConnecting || (!isConnectedStatus && !provider) || !rootLink.trim()
                      ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                      : shouldOpenCurrentRoot
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow-lg shadow-emerald-500/20"
                        : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                      }`}
                  >
                    {isConnecting
                      ? "Ověřuji..."
                      : shouldOpenCurrentRoot
                        ? <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">folder_open</span>Otevřít složku</span>
                        : isLocalProvider
                          ? "Připojit složku"
                          : "Použít tuto složku"
                    }
                  </button>
                ) : null}
              </div>
            </div>

            {/* Create New Folder (Secondary) */}
            {provider === "gdrive" && canManageGlobal && (
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
              {isLocalProvider
                ? "Vyberte složku přes Procházet nebo zadejte cestu ručně."
                : "Vložte URL adresu složky z Google Drive."}
            </div>
            {isLocalProvider && canManageGlobal && (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700/50">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Online odkaz pro sdílené uživatele
                </label>
                <input
                  type="url"
                  value={onlineRootLinkDraft}
                  onChange={(event) => setters.setOnlineRootLinkDraft(event.target.value)}
                  placeholder="https://drive.google.com/... nebo https://...sharepoint.com/..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-violet-500/50 focus:outline-none dark:border-slate-700/50 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={actions.saveOnlineLink}
                  className="mt-2 rounded-lg border border-blue-500/30 bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500"
                >
                  Uložit online odkaz
                </button>
                <p className="mt-1 text-[11px] text-slate-500">
                  Nepovinné. Uživatelé bez lokální synchronizace otevřou stejnou cloudovou složku v prohlížeči.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2">
          {(canManageGlobal || (isLocalProvider && hasPersonalLocalRoot)) && <button
            type="button"
            onClick={() => {
              if (isConnectedStatus) {
                const confirmation = isSharedProject
                  ? "Opravdu chcete odebrat svou osobní cestu na tomto zařízení?"
                  : "Opravdu chcete odpojit tuto složku od projektu?";
                if (window.confirm(confirmation)) {
                  actions.disconnect();
                }
              } else {
                if (isLocalProvider) actions.resolveRoot();
                else actions.connect();
              }
            }}
            disabled={
              isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !mode)))
            }
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isConnecting ||
              (!isConnectedStatus &&
                (!provider || (!isLocalProvider && !mode)))
              ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
              : isConnectedStatus
                ? "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 border-slate-300 dark:border-slate-700/50"
                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
              }`}
            title={
              isConnectedStatus
                ? isSharedProject
                  ? "Odebere pouze vaši osobní cestu na tomto zařízení"
                  : "Odpojí Složkomat účet pro tuto stavbu"
                : isLocalProvider
                  ? "Uloží nastavení lokální složky"
                  : "Spustí OAuth autorizaci"
            }
          >
            {isConnecting
              ? "Pracuji..."
              : isSharedProject
                ? "Odebrat moji cestu"
              : isConnectedStatus
                ? "Odpojit"
                : isLocalProvider
                  ? "Připojit složku"
                  : `Připojit přes ${provider === "gdrive" ? "Google" : "Microsoft"
                  }`}
          </button>}
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
