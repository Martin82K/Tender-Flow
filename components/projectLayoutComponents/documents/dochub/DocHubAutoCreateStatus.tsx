import React, { useMemo } from 'react';
import { useDocHubIntegration } from '../../../../hooks/useDocHubIntegration';

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubAutoCreateStatusProps {
    state: DocHubHook['state'];
    setters: DocHubHook['setters'];
    showModal: (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => void;
    showLog: boolean;
    setShowLog: (v: boolean) => void;
    showOverview: boolean;
    setShowOverview: (v: boolean) => void;
    logRef: React.RefObject<HTMLDivElement>;
    overviewRef: React.RefObject<HTMLDivElement>;
}

export const DocHubAutoCreateStatus: React.FC<DocHubAutoCreateStatusProps> = ({
    state, setters, showModal,
    showLog, setShowLog, showOverview, setShowOverview,
    logRef, overviewRef
}) => {
    const {
        isAutoCreating, autoCreateProgress, autoCreateLogs,
        backendStep, backendCounts, backendStatus, autoCreateResult
    } = state;

    // Derived logic
    const barClass = backendStatus === 'error'
        ? 'bg-gradient-to-r from-red-500 to-rose-500'
        : backendStatus === 'success'
            ? 'bg-gradient-to-r from-emerald-500 to-lime-400'
            : 'bg-gradient-to-r from-primary to-violet-500';

    const currentLog = autoCreateLogs.length > 0 ? autoCreateLogs[autoCreateLogs.length - 1] : "";

    const runLogs = autoCreateResult?.logs || [];

    const overviewFolders = useMemo(() => {
        const folders = new Set<string>();
        for (const line of runLogs) {
            const m1 = line.match(/^(?:Kontrola:|✔|↻)\s*(\/.+)$/);
            if (m1?.[1]) folders.add(m1[1].trim());
            const m2 = line.match(/→\s*(\/.+)$/);
            if (m2?.[1]) folders.add(m2[1].trim());
        }
        return Array.from(folders);
    }, [runLogs]);

    const runStats = useMemo(() => {
        const categories = runLogs.filter((l) => l.startsWith("🟩 VŘ:") || l.startsWith("VŘ:")).length;
        const warnings = runLogs.filter((l) => l.startsWith("⚠️")).length;
        const duplicates = runLogs.filter((l) => l.includes("Duplicitní složky")).length;
        const created = runLogs.filter((l) => l.startsWith("✔ ")).length;
        const reused = runLogs.filter((l) => l.startsWith("↻ ")).length;
        const skipped = runLogs.filter((l) => l.startsWith("⏭")).length;
        return { categories, warnings, duplicates, created, reused, skipped };
    }, [runLogs]);

    const summaryLine = useMemo(() => {
        return [
            `✔ ${runStats.created}`,
            `↻ ${runStats.reused}`,
            `${runStats.categories} VŘ`,
            `${runStats.warnings} varování`,
            `${runStats.duplicates} duplicit`
        ].join(" · ");
    }, [runStats]);

    if (!isAutoCreating && !autoCreateResult) return null;

    return (
        <div className="flex flex-col gap-4">
            {isAutoCreating && (
                <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Probíhá auto‑vytváření složek
                        </div>
                        <div className="text-xs text-slate-500">
                            {autoCreateProgress}%
                        </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                            className={`h-full ${barClass} transition-all`}
                            style={{ width: `${autoCreateProgress}%` }}
                        />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {backendStep || "Pracuji..."}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {currentLog}
                        </div>
                        {backendCounts && (
                            <div className="text-xs text-slate-500 shrink-0">
                                {backendCounts.total ? `${backendCounts.done}/${backendCounts.total}` : `${backendCounts.done}`}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {autoCreateResult && showLog && (
                <div ref={logRef} className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Log běhu</div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    const text = runLogs.join("\n");
                                    try {
                                        await navigator.clipboard.writeText(text);
                                        showModal({ title: "Zkopírováno", message: "Log zkopírován do schránky.", variant: "success" });
                                    } catch {
                                        window.prompt("Zkopírujte log:", text);
                                    }
                                }}
                                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                            >
                                Kopírovat
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowLog(false)}
                                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                            >
                                Skrýt
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {summaryLine}
                    </div>
                    <div className="mt-3 max-h-60 overflow-auto rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700/50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre">
                        {runLogs.join("\n")}
                    </div>
                </div>
            )}

            {autoCreateResult && showOverview && (
                <div ref={overviewRef} className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Přehled složek (z logu)</div>
                        <button
                            type="button"
                            onClick={() => setShowOverview(false)}
                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                        >
                            Skrýt
                        </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Pozn.: jde o přehled z logu (zahrnuje kontrolované i doplněné složky).
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {overviewFolders.length === 0 ? (
                            <div className="text-xs text-slate-500 dark:text-slate-400">V logu nejsou žádné cesty ke složkám.</div>
                        ) : (
                            overviewFolders.map((path) => (
                                <button
                                    key={path}
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(path);
                                            showModal({ title: "Zkopírováno", message: path, variant: "success" });
                                        } catch {
                                            window.prompt("Zkopírujte cestu:", path);
                                        }
                                    }}
                                    className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-colors"
                                    title="Kliknutím zkopírujete cestu"
                                >
                                    {path}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
