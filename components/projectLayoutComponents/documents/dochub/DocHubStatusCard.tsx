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
    const { provider, mode, rootName, rootLink } = state;

    return (
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {provider === "gdrive" ? "Google Drive" : provider === "onedrive" ? "Tender Flow Desktop" : "Provider: neuvedeno"}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {mode === "user" ? "Můj účet" : mode === "org" ? "Organizační úložiště" : "Režim: neuvedeno"}
                        </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {rootName || "Hlavní složka projektu"}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                        {rootLink}
                    </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                    {isProbablyUrl(rootLink) && (
                        <button
                            type="button"
                            onClick={() => window.open(rootLink, "_blank", "noopener,noreferrer")}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            Otevřít root
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
