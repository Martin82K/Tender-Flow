import React, { useState, useEffect, useRef, useCallback } from "react";

import {
  loadIndexFromBuffer,
  fillDescriptions,
  IndexMap,
} from "@/utils/indexMatcher";

const INDEX_STORAGE_KEY = "indexMatcherIndexData";

interface StoredIndex {
  name: string;
  size: number;
  itemCount: number;
  data: Record<string, string>; // Serializable version of IndexMap
}

export const IndexMatcherSettings: React.FC = () => {
  // Index state
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [indexMap, setIndexMap] = useState<IndexMap | null>(null);
  const [storedIndex, setStoredIndex] = useState<StoredIndex | null>(null);
  const [isIndexDropActive, setIsIndexDropActive] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Budget file state
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [isBudgetDropActive, setIsBudgetDropActive] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    percent: number;
    label: string;
  } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<{
    outputName: string;
    stats: any;
  } | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load stored index on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INDEX_STORAGE_KEY);
      if (stored) {
        const parsed: StoredIndex = JSON.parse(stored);
        setStoredIndex(parsed);
        // Reconstruct IndexMap
        const map: IndexMap = new Map(Object.entries(parsed.data));
        setIndexMap(map);
      }
    } catch (e) {
      console.error("Failed to load stored index:", e);
    }
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("cs-CZ");
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Handle index file upload
  const handleIndexFile = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setIndexError("Podporované jsou pouze soubory .xlsx a .xls");
      return;
    }

    setIndexFile(file);
    setIndexLoading(true);
    setIndexError(null);

    try {
      const buffer = await file.arrayBuffer();
      const map = await loadIndexFromBuffer(buffer, undefined, addLog);

      setIndexMap(map);

      // Store for future use
      const toStore: StoredIndex = {
        name: file.name,
        size: file.size,
        itemCount: map.size,
        data: Object.fromEntries(map),
      };
      localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(toStore));
      setStoredIndex(toStore);

      addLog(`Číselník úspěšně načten: ${map.size} položek`);
    } catch (e: any) {
      console.error("Index load error:", e);
      setIndexError(e.message || "Nepodařilo se načíst číselník");
    } finally {
      setIndexLoading(false);
    }
  };

  const handleClearIndex = () => {
    setIndexFile(null);
    setIndexMap(null);
    setStoredIndex(null);
    localStorage.removeItem(INDEX_STORAGE_KEY);
    addLog("Číselník byl vymazán");
  };

  // Handle budget file
  const handleBudgetFile = (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      alert("Podporované jsou pouze soubory .xlsx a .xls");
      return;
    }
    setBudgetFile(file);
    setProgress(null);
    setSuccessInfo(null);
  };

  // Process budget file
  const handleProcess = async () => {
    if (!budgetFile || !indexMap) {
      alert("Nahrajte prosím číselník i rozpočtový soubor.");
      return;
    }

    setIsProcessing(true);
    setProgress({ percent: 0, label: "Zahajuji zpracování..." });
    setLogs([]);
    setSuccessInfo(null);

    try {
      addLog(`Zpracovávám soubor: ${budgetFile.name}`);
      const buffer = await budgetFile.arrayBuffer();

      const result = await fillDescriptions(buffer, indexMap, {
        onProgress: (percent, label) => setProgress({ percent, label }),
        onLog: addLog,
      });

      // Download result
      const blob = new Blob([result.outputBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const baseName = budgetFile.name.replace(/\.(xlsx|xls)$/i, "");
      const outputName = `${baseName}_vyplneno.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessInfo({ outputName, stats: result.stats });
      addLog(`Soubor "${outputName}" byl stažen.`);
    } catch (e: any) {
      console.error("Processing error:", e);
      addLog(`CHYBA: ${e.message || "Neznámá chyba"}`);
      alert(`Chyba při zpracování: ${e.message || "Neznámá chyba"}`);
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-500">
          match_word
        </span>
        Index Matcher – Párování rozpočtových kódů
      </h2>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-2xl">
        Nástroj pro automatické přiřazení popisů z číselníku do stavebního
        rozpočtu. Kódy ve sloupci F jsou porovnávány s číselníkem a odpovídající
        popisy jsou zapsány do sloupce B.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Index (Codebook) Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">book_4</span>
            1. Číselník (Index)
          </h3>

          {storedIndex && !indexFile ? (
            // Show stored index info
            <div className="border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-amber-500">
                  inventory_2
                </span>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {storedIndex.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {storedIndex.itemCount} položek &middot;{" "}
                    {(storedIndex.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={handleClearIndex}
                  className="text-red-500 hover:text-red-600 text-sm font-medium hover:underline"
                >
                  Změnit
                </button>
              </div>
            </div>
          ) : (
            // Drop zone for index
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsIndexDropActive(true);
              }}
              onDragLeave={() => setIsIndexDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsIndexDropActive(false);
                const file = e.dataTransfer.files[0];
                if (file) handleIndexFile(file);
              }}
              className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                ${
                  isIndexDropActive
                    ? "border-amber-500 bg-amber-500/10 scale-[1.02]"
                    : "border-slate-300 dark:border-slate-700 hover:border-amber-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }
              `}
              onClick={() => document.getElementById("index-upload")?.click()}
            >
              <input
                type="file"
                id="index-upload"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleIndexFile(e.target.files[0]);
                }}
              />

              {indexLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-600 dark:text-slate-300">
                    Načítám číselník...
                  </span>
                </div>
              ) : indexFile ? (
                <div className="flex flex-col items-center gap-2 animate-fadeIn">
                  <span className="material-symbols-outlined text-3xl text-amber-500">
                    check_circle
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {indexFile.name}
                  </div>
                  {indexMap && (
                    <div className="text-sm text-slate-500">
                      {indexMap.size} položek načteno
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <span className="material-symbols-outlined text-3xl text-slate-400">
                    upload_file
                  </span>
                  <div className="font-bold text-slate-700 dark:text-slate-200">
                    Nahrajte číselník (index.xlsx)
                  </div>
                  <div className="text-xs text-slate-500">
                    Excel se sloupci: kód, popis
                  </div>
                </div>
              )}
            </div>
          )}

          {indexError && (
            <div className="text-red-500 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {indexError}
            </div>
          )}
        </div>

        {/* Budget File Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              table_chart
            </span>
            2. Rozpočtový soubor
          </h3>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsBudgetDropActive(true);
            }}
            onDragLeave={() => setIsBudgetDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsBudgetDropActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleBudgetFile(file);
            }}
            className={`
              border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
              ${!indexMap ? "opacity-50 pointer-events-none" : ""}
              ${
                isBudgetDropActive
                  ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
                  : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }
            `}
            onClick={() =>
              indexMap && document.getElementById("budget-upload")?.click()
            }
          >
            <input
              type="file"
              id="budget-upload"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files?.[0]) handleBudgetFile(e.target.files[0]);
              }}
            />

            {budgetFile ? (
              <div className="flex flex-col items-center gap-2 animate-fadeIn">
                <span className="material-symbols-outlined text-3xl text-emerald-500">
                  description
                </span>
                <div className="font-bold text-slate-900 dark:text-white">
                  {budgetFile.name}
                </div>
                <div className="text-sm text-slate-500">
                  {(budgetFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBudgetFile(null);
                    setProgress(null);
                    setSuccessInfo(null);
                  }}
                  className="text-red-400 hover:text-red-500 text-sm font-medium hover:underline"
                >
                  Zrušit
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <span className="material-symbols-outlined text-3xl text-slate-400">
                  {indexMap ? "upload_file" : "lock"}
                </span>
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  {indexMap
                    ? "Nahrajte rozpočet ke zpracování"
                    : "Nejdříve nahrajte číselník"}
                </div>
                <div className="text-xs text-slate-500">
                  Kódy ve sloupci F → popisy do B
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6 animate-fadeIn">
          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span>{progress.label}</span>
            <span>{Math.round(progress.percent)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Log Console */}
      {logs.length > 0 && (
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Protokol
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Vymazat
            </button>
          </div>
          <div
            ref={logContainerRef}
            className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 h-40 overflow-y-auto font-mono text-xs text-slate-300 space-y-1"
          >
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success State */}
      {successInfo && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-500 text-2xl mt-0.5">
            check_circle
          </span>
          <div>
            <div className="font-bold text-emerald-700 dark:text-emerald-400">
              Hotovo!
            </div>
            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
              Soubor <b>{successInfo.outputName}</b> byl stažen.
            </div>
            {successInfo.stats && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 grid grid-cols-2 gap-x-4 gap-y-1">
                <span>Celkem řádků:</span>
                <span className="font-medium">
                  {successInfo.stats.totalRows}
                </span>
                <span>Nalezených kódů:</span>
                <span className="font-medium">
                  {successInfo.stats.codesFound}
                </span>
                <span>Shod s číselníkem:</span>
                <span className="font-medium">
                  {successInfo.stats.matchesFound}
                </span>
                <span>Zapsaných popisů:</span>
                <span className="font-medium">
                  {successInfo.stats.descriptionsWritten}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={handleProcess}
          disabled={!indexMap || !budgetFile || isProcessing}
          className={`
            px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
            ${
              !indexMap || !budgetFile || isProcessing
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-emerald-500 text-white hover:scale-105 hover:shadow-amber-500/30"
            }
          `}
        >
          {isProcessing ? (
            <>
              <span className="animate-spin material-symbols-outlined">
                sync
              </span>
              Zpracovávám...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">play_arrow</span>
              Spustit párování
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default IndexMatcherSettings;
