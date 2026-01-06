import React from 'react';
import { useDocHubIntegration } from '../../../../hooks/useDocHubIntegration';
import { isProbablyUrl } from '../../../../utils/docHub';

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubStatusCardProps {
    state: DocHubHook['state'];
    actions: DocHubHook['actions'];
    setters: DocHubHook['setters'];
    showModal: (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => void;
}

export const DocHubStatusCard: React.FC<DocHubStatusCardProps> = ({ state, actions, setters, showModal }) => {
    const { provider, mode, rootName, rootLink, isConnecting, isAutoCreating, isMcpProvider, mcpBridgeStatus } = state;

    return (
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {provider === "gdrive" ? "Google Drive" : provider === "onedrive" ? "OneDrive" : provider === "mcp" ? "MCP (Lokální disk)" : "Provider: neuvedeno"}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {mode === "user" ? "Můj účet" : mode === "org" ? "Organizační úložiště" : "Režim: neuvedeno"}
                        </span>
                        {isMcpProvider && (
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${mcpBridgeStatus === 'connected'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300'
                                        : mcpBridgeStatus === 'disconnected'
                                            ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-300'
                                            : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-300'
                                    }`}
                                title={mcpBridgeStatus === 'connected' ? 'MCP Bridge běží' : mcpBridgeStatus === 'disconnected' ? 'MCP Bridge neběží' : 'Kontroluji...'}
                            >
                                <span className={`w-2 h-2 rounded-full ${mcpBridgeStatus === 'connected' ? 'bg-emerald-500' : mcpBridgeStatus === 'disconnected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                                    }`} />
                                {mcpBridgeStatus === 'connected' ? 'Bridge ✓' : mcpBridgeStatus === 'disconnected' ? 'Bridge ✗' : 'Bridge …'}
                            </span>
                        )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {rootName || "Hlavní složka projektu"}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                        {rootLink}
                    </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                    <button
                        type="button"
                        onClick={async () => {
                            if (isProbablyUrl(rootLink)) {
                                window.open(rootLink, "_blank", "noopener,noreferrer");
                                return;
                            }
                            try {
                                await navigator.clipboard.writeText(rootLink);
                                showModal({ title: "Zkopírováno", message: rootLink, variant: "success" });
                            } catch {
                                window.prompt("Zkopírujte cestu:", rootLink);
                            }
                        }}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                        {isProbablyUrl(rootLink) ? "Otevřít root" : "Zkopírovat root"}
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setters.setIsEditingSetup(true)}
                            disabled={isAutoCreating}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isAutoCreating
                                ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/50"
                                }`}
                            title={isAutoCreating ? "Nelze měnit během auto‑vytváření." : undefined}
                        >
                            Změnit
                        </button>
                        <button
                            type="button"
                            onClick={actions.disconnect}
                            disabled={isAutoCreating}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isAutoCreating
                                ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 border-slate-300 dark:border-slate-700/50"
                                }`}
                            title={isAutoCreating ? "Nelze odpojit během auto‑vytváření." : undefined}
                        >
                            Odpojit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
