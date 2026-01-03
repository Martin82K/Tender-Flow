import React from 'react';
import { isProbablyUrl } from '../../../utils/docHub';

interface AutoCreateModalProps {
    result: { createdCount: number | null } | null;
    rootLink: string;
    onClose: () => void;
    onShowLog: () => void;
    onShowOverview: () => void;
}

export const AutoCreateModal: React.FC<AutoCreateModalProps> = ({
    result,
    rootLink,
    onClose,
    onShowLog,
    onShowOverview
}) => {
    if (!result) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-emerald-500">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Auto‑vytváření dokončeno
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                            {result.createdCount === null
                                ? "Složky byly zkontrolovány / doplněny."
                                : `Složky byly zkontrolovány / doplněny. Akcí: ${result.createdCount}`}
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                if (isProbablyUrl(rootLink)) {
                                    window.open(rootLink, "_blank", "noopener,noreferrer");
                                    return;
                                }
                                navigator.clipboard.writeText(rootLink).catch(() => {
                                    window.prompt("Zkopírujte cestu:", rootLink);
                                });
                            }}
                            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
                        >
                            Otevřít root
                        </button>
                        <button
                            onClick={onShowLog}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-colors"
                        >
                            Zobrazit log
                        </button>
                        <button
                            onClick={onShowOverview}
                            className="col-span-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-colors"
                        >
                            Přehled vytvořených složek
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
                    >
                        Zavřít
                    </button>
                </div>
            </div>
        </div>
    );
};
