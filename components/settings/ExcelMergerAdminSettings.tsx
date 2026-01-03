import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../../services/authService';
import { useUI } from '../../context/UIContext';

const normalizeExternalUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
    return trimmed;
};

export const ExcelMergerAdminSettings: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
    const { showAlert } = useUI();
    const defaultExcelMergerMirrorUrl = useMemo(() => {
        const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as string | undefined;
        return envUrl || 'https://excelmerger-pro-production.up.railway.app';
    }, []);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [urlDraft, setUrlDraft] = useState('');

    const load = async () => {
        setIsLoading(true);
        try {
            const url = await authService.getExcelMergerMirrorUrl();
            setUrlDraft(url || '');
        } catch (e: any) {
            console.error('Failed to load Excel Merger URL:', e);
            showAlert({
                title: 'Chyba',
                message: String(e?.message || 'Nepodařilo se načíst adresu Excel Merger PRO.'),
                variant: 'danger',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    const save = async () => {
        setIsSaving(true);
        try {
            const normalized = normalizeExternalUrl(urlDraft);
            await authService.updateExcelMergerMirrorUrl(normalized || null);
            showAlert({ title: 'Hotovo', message: 'Adresa Excel Merger PRO byla uložena.', variant: 'success' });
        } catch (e: any) {
            console.error('Failed to save Excel Merger URL:', e);
            showAlert({
                title: 'Chyba',
                message: String(e?.message || 'Nepodařilo se uložit adresu Excel Merger PRO.'),
                variant: 'danger',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">table_view</span>
                Excel Merger PRO – prolinkování
                <span className="ml-2 px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30">Admin</span>
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Adresa je spravovaná centrálně v databázi a běžní uživatelé ji nemohou měnit.
            </p>

            {isLoading ? (
                <div className="text-sm text-slate-500">Načítám…</div>
            ) : (
                <>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        URL adresa externí aplikace
                    </label>
                    <div className="flex flex-col md:flex-row gap-2">
                        <input
                            type="text"
                            value={urlDraft}
                            onChange={(e) => setUrlDraft(e.target.value)}
                            placeholder={defaultExcelMergerMirrorUrl}
                            className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none font-mono"
                        />
                        <button
                            onClick={save}
                            disabled={isSaving}
                            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isSaving ? 'Ukládám…' : 'Uložit'}
                        </button>
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                try {
                                    setUrlDraft('');
                                    await authService.updateExcelMergerMirrorUrl(null);
                                    showAlert({ title: 'Reset', message: 'Adresa byla resetována (použije se výchozí).', variant: 'info' });
                                } catch (e: any) {
                                    console.error('Failed to reset Excel Merger URL:', e);
                                    showAlert({
                                        title: 'Chyba',
                                        message: String(e?.message || 'Nepodařilo se resetovat adresu Excel Merger PRO.'),
                                        variant: 'danger',
                                    });
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            disabled={isSaving}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            Reset
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        Výchozí (ENV): {defaultExcelMergerMirrorUrl}
                    </p>
                </>
            )}

            <div className="mt-4">
                <button
                    onClick={load}
                    className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    Znovu načíst
                </button>
            </div>
        </section>
    );
};
