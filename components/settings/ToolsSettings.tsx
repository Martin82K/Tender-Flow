import React, { useState, useMemo, useEffect } from "react";
import { unlockExcelZip } from "@/utils/excelUnlockZip";
import { IndexMatcherSettings } from "./IndexMatcherSettings";
import { AlertModal } from "../../components/AlertModal";

interface ToolsSettingsProps {
  // No props needed currently as this is self-contained or uses local storage
}

export const ToolsSettings: React.FC<ToolsSettingsProps> = () => {
  // Tools: Excel unlocker
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUnlockingExcel, setIsUnlockingExcel] = useState(false);
  const [excelProgress, setExcelProgress] = useState<{
    percent: number;
    label: string;
  } | null>(null);
  const [excelSuccessInfo, setExcelSuccessInfo] = useState<{
    outputName: string;
  } | null>(null);
  const [isExcelDropActive, setIsExcelDropActive] = useState(false);

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '', variant: 'error' });

  const closeAlertModal = () => setAlertModal(prev => ({ ...prev, isOpen: false }));

  const acceptExcelFile = (file: File) => {
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setAlertModal({
        isOpen: true,
        title: "Nepodporovaný formát",
        message: "Podporované jsou pouze soubory .xlsx a .xlsm.",
        variant: "error"
      });
      return;
    }
    setExcelFile(file);
    setExcelProgress(null);
    setExcelSuccessInfo(null);
  };

  const handleUnlockExcelInBrowser = async () => {
    if (!excelFile) {
      setAlertModal({
        isOpen: true,
        title: "Chyba",
        message: "Vyberte prosím Excel soubor (.xlsx).",
        variant: "info"
      });
      return;
    }

    setIsUnlockingExcel(true);
    setExcelSuccessInfo(null);
    try {
      setExcelProgress({ percent: 5, label: "Kontroluji soubor…" });
      if (!/\.(xlsx|xlsm)$/i.test(excelFile.name)) {
        throw new Error("Podporované jsou pouze soubory .xlsx a .xlsm.");
      }

      const downloadFromResponse = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };

      const baseName = excelFile.name.replace(/\.(xlsx|xlsm)$/i, "");
      const extMatch = excelFile.name.match(/\.(xlsx|xlsm)$/i);
      const originalExt = (extMatch?.[1] || "xlsx").toLowerCase();
      const outputExt = originalExt === "xlsm" ? "xlsm" : "xlsx";
      const fallbackOutName = `${baseName}-odemceno.${outputExt}`;

      setExcelProgress({ percent: 15, label: "Načítám soubor…" });
      const arrayBuffer = await excelFile.arrayBuffer();

      const out = await unlockExcelZip(arrayBuffer, {
        onProgress: (percent, label) => setExcelProgress({ percent, label }),
      });

      const blob = new Blob([out as any], {
        type:
          outputExt === "xlsm"
            ? "application/vnd.ms-excel.sheet.macroEnabled.12"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadFromResponse(blob, fallbackOutName);
      setExcelProgress({ percent: 100, label: "Staženo" });
      setExcelSuccessInfo({ outputName: fallbackOutName });
    } catch (e: any) {
      console.error("Excel unlock error:", e);
      setAlertModal({
        isOpen: true,
        title: "Chyba odemknutí",
        message: `Nepodařilo se odemknout soubor: ${e?.message || "Neznámá chyba"}`,
        variant: "error"
      });
      setExcelProgress(null);
    } finally {
      setIsUnlockingExcel(false);
    }
  };

  const EXCEL_MERGER_MIRROR_URL_STORAGE_KEY = "excelMergerMirrorUrl";

  // Excel Merger Settings
  const normalizeExternalUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/")) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
    return trimmed;
  };

  const getStoredExcelMergerMirrorUrl = () =>
    localStorage.getItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY) || "";

  const defaultExcelMergerMirrorUrl = useMemo(() => {
    const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as
      | string
      | undefined;
    return envUrl || "https://vas-excel-merger-gcp.web.app";
  }, []);

  const [excelMergerMirrorUrlDraft, setExcelMergerMirrorUrlDraft] = useState(
    () => getStoredExcelMergerMirrorUrl()
  );
  const [excelMergerMirrorUrlOverride, setExcelMergerMirrorUrlOverride] =
    useState(() => getStoredExcelMergerMirrorUrl());
  const [
    isExcelMergerAddressSettingsOpen,
    setIsExcelMergerAddressSettingsOpen,
  ] = useState(false);

  const excelMergerMirrorUrl = useMemo(() => {
    const raw = excelMergerMirrorUrlOverride.trim();
    if (!raw) return defaultExcelMergerMirrorUrl;
    return normalizeExternalUrl(raw);
  }, [defaultExcelMergerMirrorUrl, excelMergerMirrorUrlOverride]);

  const ExcelMergerMirror: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      setIsLoading(true);
    }, [excelMergerMirrorUrl]);

    return (
      <div className="relative w-full h-[800px] mt-6 rounded-3xl border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-950/70 z-50">
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="font-black text-slate-900 dark:text-white">
                  Propojování s ExcelMerger Pro…
                </p>
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
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400">
            handyman
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Nástroje
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Pomocné nástroje pro práci se soubory
        </p>
      </div>

      {/* Excel Unlocker */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">
            lock_open
          </span>
          Odemknutí Excel listů
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-2xl">
          Tento nástroj odstraní zámek (heslo) sešitů a listů z .xlsx/.xlsm
          souborů. Vše probíhá lokálně ve vašem prohlížeči, soubory se nikam
          neodesílají.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsExcelDropActive(true);
          }}
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
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
              : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }
                    `}
          onClick={() =>
            document.getElementById("excel-upload-trigger")?.click()
          }
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
              <span className="material-symbols-outlined text-4xl text-emerald-500">
                description
              </span>
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
              <span className="material-symbols-outlined text-4xl text-slate-400">
                upload_file
              </span>
              <div className="font-bold text-slate-700 dark:text-slate-200">
                Vyberte nebo přetáhněte Excel soubor
              </div>
              <div className="text-xs text-slate-500">
                Podporuje .xlsx a .xlsm
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
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

        {/* Success State */}
        {excelSuccessInfo && (
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-500 text-2xl">
              check_circle
            </span>
            <div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                Hotovo!
              </div>
              <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                Soubor <b>{excelSuccessInfo.outputName}</b> byl stažen.
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleUnlockExcelInBrowser}
            disabled={!excelFile || isUnlockingExcel}
            className={`
                            px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
                            ${!excelFile || isUnlockingExcel
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-emerald-400 text-white hover:scale-105 hover:shadow-emerald-500/30"
              }
                        `}
          >
            {isUnlockingExcel ? (
              <>
                <span className="animate-spin material-symbols-outlined">
                  sync
                </span>
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

      {/* Excel Merger with Custom Address */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">
              table_view
            </span>
            Excel Merger Pro
          </h2>
          <button
            onClick={() =>
              setIsExcelMergerAddressSettingsOpen(
                !isExcelMergerAddressSettingsOpen
              )
            }
            className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              settings
            </span>
            Nastavit adresu
          </button>
        </div>

        {isExcelMergerAddressSettingsOpen && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 animate-fadeIn">
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
                  localStorage.setItem(
                    EXCEL_MERGER_MIRROR_URL_STORAGE_KEY,
                    excelMergerMirrorUrlDraft
                  );
                  setIsExcelMergerAddressSettingsOpen(false);
                }}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Použít
              </button>
              <button
                onClick={() => {
                  setExcelMergerMirrorUrlDraft("");
                  setExcelMergerMirrorUrlOverride("");
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

        <ExcelMergerMirror />
      </section>

      {/* Index Matcher */}
      <IndexMatcherSettings />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlertModal}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  );
};
