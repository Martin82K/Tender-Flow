import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../../services/authService';
import { ExcelService } from '../../services/excelMergerService';
import { useUI } from '../../context/UIContext';

// Dynamic desktop detection helper - must be called at runtime, not module load
const checkIsDesktop = () => typeof window !== 'undefined' && !!window.electronAPI?.platform?.isDesktop;

interface SheetInfo {
    name: string;
    isSelected: boolean;
}

export const ExcelMergerProSettings: React.FC = () => {
    const { showAlert } = useUI();

    // Dynamic check at render time - avoids module-level evaluation timing issue
    const isDesktop = useMemo(() => checkIsDesktop(), []);

    // ─────────────────────────────────────────
    // Desktop (Native) State
    // ─────────────────────────────────────────
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<SheetInfo[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
    const [logHistory, setLogHistory] = useState<string[]>([]);
    const [successInfo, setSuccessInfo] = useState<{ outputName: string } | null>(null);
    const [isDropActive, setIsDropActive] = useState(false);

    // ─────────────────────────────────────────
    // Web (Iframe) State
    // ─────────────────────────────────────────
    const defaultExcelMergerMirrorUrl = useMemo(() => {
        const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as string | undefined;
        return envUrl || 'https://excelmerger-pro-production.up.railway.app';
    }, []);

    const [adminConfiguredUrl, setAdminConfiguredUrl] = useState<string | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isLoadingIframe, setIsLoadingIframe] = useState(true);

    // Load admin-configured URL from database (for web version)
    useEffect(() => {
        if (isDesktop) {
            setIsLoadingConfig(false);
            return;
        }
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

    // ─────────────────────────────────────────
    // Desktop Handlers
    // ─────────────────────────────────────────
    const acceptFile = async (file: File) => {
        if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
            showAlert({ title: 'Nepodporovaný soubor', message: 'Podporované jsou pouze soubory .xlsx a .xlsm.', variant: 'danger' });
            return;
        }
        setExcelFile(file);
        setSheets([]);
        setProgress(null);
        setLogHistory([]);
        setSuccessInfo(null);

        // Analyze file to get sheets
        setIsAnalyzing(true);
        try {
            const sheetNames = await ExcelService.analyzeFile(file);
            setSheets(sheetNames.map(name => ({ name, isSelected: true })));
        } catch (e: any) {
            console.error('Analyze error:', e);
            showAlert({ title: 'Nepodařilo se načíst listy', message: e?.message || 'Neznámá chyba', variant: 'danger' });
            setExcelFile(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleSheet = (index: number) => {
        setSheets(prev => prev.map((s, i) => i === index ? { ...s, isSelected: !s.isSelected } : s));
    };

    const selectAll = () => {
        setSheets(prev => prev.map(s => ({ ...s, isSelected: true })));
    };

    const deselectAll = () => {
        setSheets(prev => prev.map(s => ({ ...s, isSelected: false })));
    };

    const handleMerge = async () => {
        if (!excelFile) return;
        const selectedSheets = sheets.filter(s => s.isSelected).map(s => s.name);
        if (selectedSheets.length === 0) {
            showAlert({ title: 'Žádné listy', message: 'Vyberte alespoň jeden list ke sloučení.', variant: 'info' });
            return;
        }

        setIsMerging(true);
        setSuccessInfo(null);
        setLogHistory([]);
        try {
            const blob = await ExcelService.mergeSheets(
                excelFile,
                selectedSheets,
                (msg) => {
                    setProgress(prev => ({ percent: prev?.percent || 0, label: msg }));
                    setLogHistory(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
                },
                (pct) => setProgress(prev => ({ percent: pct, label: prev?.label || '' })),
                undefined, // headerMapping
                true,      // applyFilter
                true,      // freezeHeader
                true       // showGridlines
            );

            // Download result
            const baseName = excelFile.name.replace(/\.(xlsx|xlsm)$/i, '');
            const outputName = `${baseName}-merged.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outputName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            setProgress({ percent: 100, label: 'Staženo' });
            setLogHistory(prev => [...prev, `[${new Date().toLocaleTimeString()}] Hotovo.`]);
            setSuccessInfo({ outputName });
        } catch (e: any) {
            console.error('Merge error:', e);
            showAlert({ title: 'Chyba při slučování', message: e?.message || 'Neznámá chyba', variant: 'danger' });
            setProgress(null);
        } finally {
            setIsMerging(false);
        }
    };

    const resetFile = () => {
        setExcelFile(null);
        setSheets([]);
        setProgress(null);
        setLogHistory([]);
        setSuccessInfo(null);
    };

    // ─────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────

    // Feature availability for iframe (web only)
    const isFeatureAvailable = isDesktop || !!adminConfiguredUrl;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400">table_view</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Excel Merger PRO
                    </h2>
                </div>
                <p className="text-sm text-slate-500">
                    {isDesktop ? 'Sloučení listů z Excel souboru do jednoho (lokálně)' : 'Externí aplikace ve vestavěném okně'}
                </p>
            </div>

            {isDesktop ? (
                /* ═══════════════════════════════════════════════════════════
                   DESKTOP: Native UI
                   ═══════════════════════════════════════════════════════════ */
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-2xl">
                        Tento nástroj sloučí všechny vybrané listy z Excel souboru do jednoho listu.
                        Vše probíhá lokálně, soubory se nikam neodesílají.
                    </p>

                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDropActive(true); }}
                        onDragLeave={() => setIsDropActive(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDropActive(false);
                            const file = e.dataTransfer.files[0];
                            if (file) acceptFile(file);
                        }}
                        className={`
                            border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                            ${isDropActive
                                ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }
                        `}
                        onClick={() => document.getElementById('excel-merger-upload')?.click()}
                    >
                        <input
                            type="file"
                            id="excel-merger-upload"
                            className="hidden"
                            accept=".xlsx,.xlsm"
                            onChange={(e) => {
                                if (e.target.files?.[0]) acceptFile(e.target.files[0]);
                            }}
                        />

                        {excelFile ? (
                            <div className="flex flex-col items-center gap-2 animate-fadeIn">
                                <span className="material-symbols-outlined text-4xl text-blue-500">description</span>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                    {excelFile.name}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {(excelFile.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); resetFile(); }}
                                    className="mt-2 text-red-400 hover:text-red-500 text-sm font-medium hover:underline"
                                >
                                    Zrušit
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 pointer-events-none">
                                <span className="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                                <div className="font-bold text-slate-700 dark:text-slate-200">
                                    Nahrajte Excel
                                </div>
                                <div className="text-xs text-slate-500">
                                    Přetáhněte soubor sem nebo klikněte
                                </div>
                                <span className="mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                                    .xlsx / .xlsm
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Analyzing Spinner */}
                    {isAnalyzing && (
                        <div className="mt-6 flex items-center justify-center gap-3 animate-fadeIn">
                            <span className="animate-spin material-symbols-outlined text-blue-500">sync</span>
                            <span className="text-sm text-slate-600 dark:text-slate-300">Načítám listy...</span>
                        </div>
                    )}

                    {/* Sheet Selection */}
                    {sheets.length > 0 && !isAnalyzing && (
                        <div className="mt-6 animate-fadeIn">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-slate-900 dark:text-white">Listy k sloučení</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    >
                                        Vybrat vše
                                    </button>
                                    <button
                                        onClick={deselectAll}
                                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    >
                                        Zrušit výběr
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                                {sheets.map((sheet, idx) => (
                                    <label
                                        key={sheet.name}
                                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx !== sheets.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={sheet.isSelected}
                                            onChange={() => toggleSheet(idx)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{sheet.name}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Vybráno: {sheets.filter(s => s.isSelected).length} z {sheets.length} listů
                            </p>
                        </div>
                    )}

                    {/* Progress */}
                    {progress && (
                        <div className="mt-6 animate-fadeIn">
                            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                <span>{progress.label}</span>
                                <span>{Math.round(progress.percent)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Log Console */}
                    {logHistory.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono h-48 overflow-y-auto border border-slate-700 shadow-inner">
                            <div className="flex flex-col gap-1">
                                {logHistory.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                                ))}
                                <div id="log-end" />
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {successInfo && (
                        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-fadeIn">
                            <span className="material-symbols-outlined text-emerald-500 text-2xl">check_circle</span>
                            <div>
                                <div className="font-bold text-emerald-700 dark:text-emerald-400">Hotovo!</div>
                                <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                                    Soubor <b>{successInfo.outputName}</b> byl stažen.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Merge Button */}
                    {sheets.length > 0 && !isAnalyzing && (
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={handleMerge}
                                disabled={isMerging || sheets.filter(s => s.isSelected).length === 0}
                                className={`
                                    px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
                                    ${isMerging || sheets.filter(s => s.isSelected).length === 0
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-400 text-white hover:scale-105 hover:shadow-blue-500/30'
                                    }
                                `}
                            >
                                {isMerging ? (
                                    <>
                                        <span className="animate-spin material-symbols-outlined">sync</span>
                                        Slučuji...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">merge</span>
                                        Sloučit listy
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </section>
            ) : (
                /* ═══════════════════════════════════════════════════════════
                   WEB: Iframe UI (unchanged)
                   ═══════════════════════════════════════════════════════════ */
                <>
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
                                    src={adminConfiguredUrl!}
                                    className="w-full h-full border-none"
                                    onLoad={() => setIsLoadingIframe(false)}
                                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
                                    referrerPolicy="no-referrer"
                                    title="Excel Merger"
                                />
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};
