import React, { useState, useCallback, useEffect } from 'react';
import { ProjectDetails } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import { AlertModal } from '../../../AlertModal';
import { ConfirmationModal } from '../../../ConfirmationModal';

interface DocHubHistoryProps {
    project: ProjectDetails;
    onSelectRun: (run: any, mode: 'log' | 'overview') => void;
}

export const DocHubHistory: React.FC<DocHubHistoryProps> = ({ project, onSelectRun }) => {
    const [history, setHistory] = useState<Array<{
        id: string;
        status: 'running' | 'success' | 'error';
        step: string | null;
        progress_percent: number;
        total_actions: number | null;
        completed_actions: number;
        logs: string[];
        error: string | null;
        started_at: string;
        finished_at: string | null;
    }>>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<{
        onlyErrors: boolean;
        onlyCreated: boolean;
        days: number;
    }>({
        onlyErrors: false,
        onlyCreated: false,
        days: 30,
    });

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'info';
    }>({ isOpen: false, title: '', message: '', variant: 'info' });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
        confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const closeAlertModal = () => setAlertModal(prev => ({ ...prev, isOpen: false }));
    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const countCreatedFromLogs = (logs: unknown): number => {
        if (!Array.isArray(logs)) return 0;
        return (logs as unknown[]).filter((l) => typeof l === "string" && l.startsWith("✔ ")).length;
    };

    const [isOpen, setIsOpen] = useState(false);

    const loadHistory = useCallback(async () => {
        if (!project.id) return;
        setIsLoading(true);
        try {
            const since = new Date(Date.now() - Math.max(1, filter.days) * 24 * 60 * 60 * 1000).toISOString();
            let query = supabase
                .from("dochub_autocreate_runs")
                .select("id,status,step,progress_percent,total_actions,completed_actions,logs,error,started_at,finished_at")
                .eq("project_id", project.id)
                .gte("started_at", since)
                .order("started_at", { ascending: false })
                .limit(50);
            if (filter.onlyErrors) query = query.eq("status", "error");

            const { data, error } = await query;
            if (error || !data) return;

            const filtered = filter.onlyCreated
                ? (data as any[]).filter((run) => countCreatedFromLogs(run?.logs) > 0)
                : (data as any[]);
            setHistory(filtered as any);
        } finally {
            setIsLoading(false);
        }
    }, [project.id, filter]);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [loadHistory, isOpen]);

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all">
                <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <div className="flex items-center gap-2">
                        <div className={`transform transition-transform ${isOpen ? 'rotate-90' : ''} text-slate-500`}>
                            ►
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Historie běhů</div>
                    </div>
                </div>

                {isOpen && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-end gap-2 mb-4">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setFilter((prev) => ({ ...prev, onlyErrors: !prev.onlyErrors })); }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${filter.onlyErrors
                                    ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                                    : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                    }`}
                                title="Zobrazí pouze běhy s chybou"
                            >
                                Jen chyby
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setFilter((prev) => ({ ...prev, onlyCreated: !prev.onlyCreated })); }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${filter.onlyCreated
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                    }`}
                                title="Zobrazí pouze běhy, kde došlo k vytvoření alespoň jedné složky"
                            >
                                Akce &gt; 0
                            </button>
                            <select
                                value={filter.days}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setFilter((prev) => ({ ...prev, days: Number(e.target.value) || 30 }))}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/50 text-slate-700 dark:text-slate-200"
                                title="Poslední X dní"
                            >
                                <option value={1}>1 den</option>
                                <option value={3}>3 dny</option>
                                <option value={7}>7 dní</option>
                                <option value={14}>14 dní</option>
                                <option value={30}>30 dní</option>
                                <option value={90}>90 dní</option>
                            </select>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); loadHistory(); }}
                                disabled={isLoading}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isLoading
                                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                    : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                    }`}
                            >
                                Obnovit
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                        isOpen: true,
                                        title: "Smazat logy",
                                        message: "Opravdu smazat logy starší 20 dní?",
                                        confirmLabel: "Smazat",
                                        variant: "danger",
                                        onConfirm: async () => {
                                            closeConfirmModal();
                                            const cutoff = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
                                            const { error } = await supabase
                                                .from('dochub_autocreate_runs')
                                                .delete()
                                                .eq('project_id', project.id)
                                                .lt('started_at', cutoff);
                                            if (error) {
                                                setAlertModal({
                                                    isOpen: true,
                                                    title: "Chyba",
                                                    message: 'Chyba při mazání: ' + error.message,
                                                    variant: "error"
                                                });
                                            } else {
                                                loadHistory();
                                            }
                                        }
                                    });
                                }}
                                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors border bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                                title="Smazat logy starší 20 dní"
                            >
                                🗑 Starší 20d
                            </button>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Logy se ukládají k projektu a můžete se k nim kdykoliv vrátit.
                        </div>
                        <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {history.length === 0 ? (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {isLoading ? "Načítám…" : "Zatím žádné běhy."}
                                </div>
                            ) : (
                                history.map((run) => {
                                    const statusBadge =
                                        run.status === "success"
                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                            : run.status === "error"
                                                ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                                                : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
                                    const started = new Date(run.started_at).toLocaleString("cs-CZ");
                                    const actionsText = run.total_actions ? `${run.completed_actions}/${run.total_actions}` : `${run.completed_actions}`;
                                    const warnings = Array.isArray(run.logs) ? run.logs.filter((l) => typeof l === "string" && l.startsWith("⚠️")).length : 0;
                                    const duplicates = Array.isArray(run.logs) ? run.logs.filter((l) => typeof l === "string" && l.includes("Duplicitní složky")).length : 0;
                                    return (
                                        <div key={run.id} className="flex items-start justify-between gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${statusBadge}`}>
                                                        {run.status === "success" ? "Dokončeno" : run.status === "error" ? "Chyba" : "Běží"}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{started}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">Akce: {actionsText}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">⚠ {warnings}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">🧩 {duplicates}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 truncate">
                                                    {run.error ? run.error : (run.step || "")}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectRun(run, 'log')}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                >
                                                    Log
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectRun(run, 'overview')}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                >
                                                    Přehled
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>


            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={closeAlertModal}
                title={alertModal.title}
                message={alertModal.message}
                variant={alertModal.variant}
            />
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                confirmLabel={confirmModal.confirmLabel || 'OK'}
                variant={confirmModal.variant || 'danger'}
            />
        </div >
    );
};
