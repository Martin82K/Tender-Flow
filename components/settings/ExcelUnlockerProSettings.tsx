import React, { useState } from 'react';
import { unlockExcelZip } from '@/utils/excelUnlockZip';
import { useUI } from '../../context/UIContext';

export const ExcelUnlockerProSettings: React.FC = () => {
    const { showAlert } = useUI();
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [isUnlockingExcel, setIsUnlockingExcel] = useState(false);
    const [excelProgress, setExcelProgress] = useState<{ percent: number; label: string } | null>(null);
    const [excelSuccessInfo, setExcelSuccessInfo] = useState<{ outputName: string } | null>(null);
    const [isExcelDropActive, setIsExcelDropActive] = useState(false);

    const acceptExcelFile = (file: File) => {
        if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
            showAlert({ title: 'Nepodporovaný soubor', message: 'Podporované jsou pouze soubory .xlsx a .xlsm.', variant: 'danger' });
            return;
        }
        setExcelFile(file);
        setExcelProgress(null);
        setExcelSuccessInfo(null);
    };

    const handleUnlockExcelInBrowser = async () => {
        if (!excelFile) {
            showAlert({ title: 'Chybí soubor', message: 'Vyberte prosím Excel soubor (.xlsx/.xlsm).', variant: 'info' });
            return;
        }

        setIsUnlockingExcel(true);
        setExcelSuccessInfo(null);
        try {
            setExcelProgress({ percent: 5, label: 'Kontroluji soubor…' });
            if (!/\.(xlsx|xlsm)$/i.test(excelFile.name)) {
                throw new Error('Podporované jsou pouze soubory .xlsx a .xlsm.');
            }

            const downloadFromResponse = (blob: Blob, filename: string) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };

            const baseName = excelFile.name.replace(/\.(xlsx|xlsm)$/i, '');
            const extMatch = excelFile.name.match(/\.(xlsx|xlsm)$/i);
            const originalExt = (extMatch?.[1] || 'xlsx').toLowerCase();
            const outputExt = originalExt === 'xlsm' ? 'xlsm' : 'xlsx';
            const fallbackOutName = `${baseName}-odemceno.${outputExt}`;

            setExcelProgress({ percent: 15, label: 'Načítám soubor…' });
            const arrayBuffer = await excelFile.arrayBuffer();

            const out = await unlockExcelZip(arrayBuffer, {
                onProgress: (percent, label) => setExcelProgress({ percent, label }),
            });

            const blob = new Blob([out as any], {
                type:
                    outputExt === 'xlsm'
                        ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
                        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            downloadFromResponse(blob, fallbackOutName);
            setExcelProgress({ percent: 100, label: 'Staženo' });
            setExcelSuccessInfo({ outputName: fallbackOutName });
        } catch (e: any) {
            console.error('Excel unlock error:', e);
            showAlert({ title: 'Nepodařilo se odemknout', message: `${e?.message || 'Neznámá chyba'}`, variant: 'danger' });
            setExcelProgress(null);
        } finally {
            setIsUnlockingExcel(false);
        }
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">lock_open</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Excel Unlocker PRO
                    </h2>
                </div>
                <p className="text-sm text-slate-500">Odemknutí listů/sešitů z .xlsx/.xlsm (lokálně v prohlížeči)</p>
            </div>

            <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-2xl">
                    Tento nástroj odstraní zámek (heslo) sešitů a listů z .xlsx/.xlsm souborů.
                    Vše probíhá lokálně ve vašem prohlížeči, soubory se nikam neodesílají.
                </p>

                <div
                    onDragOver={(e) => { e.preventDefault(); setIsExcelDropActive(true); }}
                    onDragLeave={() => setIsExcelDropActive(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsExcelDropActive(false);
                        const file = e.dataTransfer.files[0];
                        if (file) acceptExcelFile(file);
                    }}
                    className={`
                        border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                        ${isExcelDropActive
                            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]'
                            : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }
                    `}
                    onClick={() => document.getElementById('excel-upload-trigger')?.click()}
                >
                    <input
                        type="file"
                        id="excel-upload-trigger"
                        className="hidden"
                        accept=".xlsx,.xlsm"
                        onChange={(e) => {
                            if (e.target.files?.[0]) acceptExcelFile(e.target.files[0]);
                        }}
                    />

                    {excelFile ? (
                        <div className="flex flex-col items-center gap-2 animate-fadeIn">
                            <span className="material-symbols-outlined text-4xl text-emerald-500">description</span>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {excelFile.name}
                            </div>
                            <div className="text-sm text-slate-500">
                                {(excelFile.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExcelFile(null);
                                    setExcelProgress(null);
                                    setExcelSuccessInfo(null);
                                }}
                                className="mt-2 text-red-400 hover:text-red-500 text-sm font-medium hover:underline"
                            >
                                Zrušit
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            <span className="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                            <div className="font-bold text-slate-700 dark:text-slate-200">
                                Vyberte nebo přetáhněte Excel soubor
                            </div>
                            <div className="text-xs text-slate-500">
                                Podporuje .xlsx a .xlsm
                            </div>
                        </div>
                    )}
                </div>

                {excelProgress && (
                    <div className="mt-6 animate-fadeIn">
                        <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            <span>{excelProgress.label}</span>
                            <span>{Math.round(excelProgress.percent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${excelProgress.percent}%` }}
                            />
                        </div>
                    </div>
                )}

                {excelSuccessInfo && (
                    <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-fadeIn">
                        <span className="material-symbols-outlined text-emerald-500 text-2xl">check_circle</span>
                        <div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">Hotovo!</div>
                            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                                Soubor <b>{excelSuccessInfo.outputName}</b> byl stažen.
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleUnlockExcelInBrowser}
                        disabled={!excelFile || isUnlockingExcel}
                        className={`
                            px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
                            ${!excelFile || isUnlockingExcel
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-400 text-white hover:scale-105 hover:shadow-emerald-500/30'
                            }
                        `}
                    >
                        {isUnlockingExcel ? (
                            <>
                                <span className="animate-spin material-symbols-outlined">sync</span>
                                Pracuji...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">lock_open</span>
                                Odemknout soubor
                            </>
                        )}
                    </button>
                </div>
            </section>
        </div>
    );
};
