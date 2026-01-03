import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../../services/authService';

export const ExcelMergerProSettings: React.FC = () => {
    // Default from ENV (only used as reference, not fallback)
    const defaultExcelMergerMirrorUrl = useMemo(() => {
        const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as string | undefined;
        return envUrl || 'https://excelmerger-pro-production.up.railway.app';
    }, []);

    const [adminConfiguredUrl, setAdminConfiguredUrl] = useState<string | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isLoadingIframe, setIsLoadingIframe] = useState(true);

    // Load admin-configured URL from database
    useEffect(() => {
        (async () => {
            setIsLoadingConfig(true);
            try {
                const url = await authService.getExcelMergerMirrorUrl();
                setAdminConfiguredUrl(url);
            } catch (e) {
                console.warn('Failed to load Excel Merger URL:', e);
                setAdminConfiguredUrl(null);
            } finally {
                setIsLoadingConfig(false);
            }
        })();
    }, []);

    // Reset iframe loading state when URL changes
    useEffect(() => {
        if (adminConfiguredUrl) {
            setIsLoadingIframe(true);
        }
    }, [adminConfiguredUrl]);

    // Feature is only available if admin has configured a URL
    const isFeatureAvailable = !!adminConfiguredUrl;

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

            {isLoadingConfig ? (
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500">Načítám konfiguraci…</p>
                        </div>
                    </div>
                </section>
            ) : !isFeatureAvailable ? (
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-slate-400 text-3xl">link_off</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Funkce není dostupná
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md">
                            Excel Merger PRO není nakonfigurován pro tuto instanci aplikace.
                            Administrátor musí nejprve nastavit URL adresu externí aplikace v sekci{' '}
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                Administrace → Registrace
                            </span>.
                        </p>
                        <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-xs text-slate-400">
                                Výchozí URL (ENV): <code className="font-mono">{defaultExcelMergerMirrorUrl}</code>
                            </p>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            Propojení spravuje administrátor.
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Aktivní
                        </span>
                    </div>

                    <div className="relative w-full h-[800px] mt-6 rounded-3xl border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur">
                        {isLoadingIframe && (
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
                            key={adminConfiguredUrl}
                            src={adminConfiguredUrl}
                            className="w-full h-full border-none"
                            onLoad={() => setIsLoadingIframe(false)}
                            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
                            referrerPolicy="no-referrer"
                            title="Excel Merger"
                        />
                    </div>
                </section>
            )}
        </div>
    );
};
