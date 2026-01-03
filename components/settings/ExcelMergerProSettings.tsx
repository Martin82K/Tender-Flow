import React, { useEffect, useMemo, useState } from 'react';

const EXCEL_MERGER_MIRROR_URL_STORAGE_KEY = 'excelMergerMirrorUrl';

const normalizeExternalUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
    return trimmed;
};

const getStoredExcelMergerMirrorUrl = () => localStorage.getItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY) || '';

export const ExcelMergerProSettings: React.FC = () => {
    const defaultExcelMergerMirrorUrl = useMemo(() => {
        const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as string | undefined;
        return envUrl || 'https://vas-excel-merger-gcp.web.app';
    }, []);

    const [excelMergerMirrorUrlDraft, setExcelMergerMirrorUrlDraft] = useState(() => getStoredExcelMergerMirrorUrl());
    const [excelMergerMirrorUrlOverride, setExcelMergerMirrorUrlOverride] = useState(() => getStoredExcelMergerMirrorUrl());
    const [isExcelMergerAddressSettingsOpen, setIsExcelMergerAddressSettingsOpen] = useState(false);

    const excelMergerMirrorUrl = useMemo(() => {
        const raw = excelMergerMirrorUrlOverride.trim();
        if (!raw) return defaultExcelMergerMirrorUrl;
        return normalizeExternalUrl(raw);
    }, [defaultExcelMergerMirrorUrl, excelMergerMirrorUrlOverride]);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
    }, [excelMergerMirrorUrl]);

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400">table_view</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Excel Merger PRO
                    </h2>
                </div>
                <p className="text-sm text-slate-500">Externí aplikace ve vestavěném okně</p>
            </div>

            <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        Adresa: <span className="font-mono text-xs">{excelMergerMirrorUrl}</span>
                    </div>
                    <button
                        onClick={() => setIsExcelMergerAddressSettingsOpen(!isExcelMergerAddressSettingsOpen)}
                        className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">settings</span>
                        Nastavit adresu
                    </button>
                </div>

                {isExcelMergerAddressSettingsOpen && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 animate-fadeIn">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            URL adresa externí aplikace
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={excelMergerMirrorUrlDraft}
                                onChange={(e) => setExcelMergerMirrorUrlDraft(e.target.value)}
                                placeholder={defaultExcelMergerMirrorUrl}
                                className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                            <button
                                onClick={() => {
                                    setExcelMergerMirrorUrlOverride(excelMergerMirrorUrlDraft);
                                    localStorage.setItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY, excelMergerMirrorUrlDraft);
                                    setIsExcelMergerAddressSettingsOpen(false);
                                }}
                                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                            >
                                Použít
                            </button>
                            <button
                                onClick={() => {
                                    setExcelMergerMirrorUrlDraft('');
                                    setExcelMergerMirrorUrlOverride('');
                                    localStorage.removeItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY);
                                    setIsExcelMergerAddressSettingsOpen(false);
                                }}
                                className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                            Výchozí: {defaultExcelMergerMirrorUrl}
                        </p>
                    </div>
                )}

                <div className="relative w-full h-[800px] mt-6 rounded-3xl border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-950/70 z-50">
                            <div className="flex flex-col items-center gap-4 text-center px-6">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <div className="space-y-1">
                                    <p className="font-black text-slate-900 dark:text-white">Propojování s ExcelMerger PRO…</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        Načítám externí aplikaci ve vestavěném okně.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <iframe
                        key={excelMergerMirrorUrl}
                        src={excelMergerMirrorUrl}
                        className="w-full h-full border-none"
                        onLoad={() => setIsLoading(false)}
                        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
                        referrerPolicy="no-referrer"
                        title="Excel Merger"
                    />
                </div>
            </section>
        </div>
    );
};

