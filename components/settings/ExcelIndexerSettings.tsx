import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { fillDescriptions, IndexMap } from "@/utils/indexMatcher";
import { fillOddily, FillOddilyResult } from "@/utils/fillOddily";
import {
  loadIndexEntries,
  addIndexEntry,
  addIndexEntriesBulk,
  updateIndexEntry,
  deleteIndexEntry,
  deleteAllIndexEntries,
  IndexEntry,
} from "@/services/indexerService";

const SETTINGS_KEY = "excelIndexerSettings";

// Phase state type
type ProcessingPhase = 'ready' | 'phase1-processing' | 'phase1-done' | 'phase2-processing' | 'phase2-done';

interface IndexerSettings {
  // Phase 1 settings (original file before column insertion)
  markerColumn: string;   // Column to search for "D" marker (default: F)
  sectionColumn: string;  // Column with section names (default: G)
  // Phase 2 settings (after column B inserted, columns shift right)
  codeColumn: string;     // Column with item codes (default: G, was F)
  descColumn: string;     // Column to write descriptions (default: C, was B)
  createRecapitulation: boolean;
}

// Default settings
// Phase 1: Look in F for "D", get section from G (original positions)
// Phase 2: After insert, F→G for codes, B→C for descriptions
const DEFAULT_SETTINGS: IndexerSettings = {
  markerColumn: "F",      // Where to look for "D" (before insert)
  sectionColumn: "G",     // Where section names are (before insert)
  codeColumn: "G",        // Codes column (after insert, was F)
  descColumn: "C",        // Descriptions column (after insert, was B)
  createRecapitulation: false,
};

// Column options A-Z
const COLUMN_OPTIONS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);

export const ExcelIndexerSettings: React.FC = () => {
  // Index entries from database
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Settings (still localStorage - personal preference)
  const [settings, setSettings] = useState<IndexerSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  // File state
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [isBudgetDropActive, setIsBudgetDropActive] = useState(false);

  // Two-phase processing state
  const [phase, setPhase] = useState<ProcessingPhase>('ready');
  const [phase1OutputBuffer, setPhase1OutputBuffer] = useState<ArrayBuffer | null>(null);
  const [phase1Stats, setPhase1Stats] = useState<FillOddilyResult['stats'] | null>(null);

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

  // Load data on mount
  useEffect(() => {
    loadData();
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await loadIndexEntries();
      setEntries(data);
    } catch (e) {
      console.error("Failed to load entries:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

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

  // Build IndexMap from entries
  const buildIndexMap = useCallback((): IndexMap => {
    const map: IndexMap = new Map();
    entries.forEach((e) => {
      if (e.code && e.description) {
        map.set(e.code, e.description);
      }
    });
    return map;
  }, [entries]);

  // Import from Excel
  const handleImportExcel = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      alert("Podporované jsou pouze soubory .xlsx a .xls");
      return;
    }

    setIsSaving(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

      const newEntries: { code: string; description: string }[] = [];
      const existingCodes = new Set(entries.map((e) => e.code));

      for (const row of data) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const nonEmpty = row.filter(
          (v) => v !== null && v !== undefined && String(v).trim() !== ""
        );
        if (nonEmpty.length < 2) continue;

        const code = String(nonEmpty[0]).trim();
        const desc = String(nonEmpty[1]).trim();
        if (code && desc && !existingCodes.has(code)) {
          newEntries.push({ code, description: desc });
          existingCodes.add(code);
        }
      }

      if (newEntries.length > 0) {
        const count = await addIndexEntriesBulk(newEntries);
        addLog(`Importováno ${count} nových položek z ${file.name}`);
        await loadData();
      } else {
        addLog(`Žádné nové položky k importu z ${file.name}`);
      }
    } catch (e: any) {
      console.error("Import error:", e);
      alert(`Chyba při importu: ${e.message || "Neznámá chyba"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add new entry
  const handleAddEntry = async () => {
    if (!newCode.trim() || !newDesc.trim()) return;

    if (entries.some((e) => e.code === newCode.trim())) {
      alert("Tento kód již existuje");
      return;
    }

    setIsSaving(true);
    try {
      const result = await addIndexEntry({
        code: newCode.trim(),
        description: newDesc.trim(),
      });
      if (result) {
        setEntries((prev) => [...prev, result]);
        setNewCode("");
        setNewDesc("");
        setIsAddingNew(false);
        addLog(`Přidána položka: ${result.code}`);
      }
    } catch (e) {
      console.error("Error adding entry:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Update entry
  const handleUpdateEntry = async (
    id: string,
    code: string,
    description: string
  ) => {
    setIsSaving(true);
    try {
      const success = await updateIndexEntry(id, { code, description });
      if (success) {
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, code, description } : e))
        );
        addLog(`Aktualizována položka: ${code}`);
      }
    } catch (e) {
      console.error("Error updating entry:", e);
    } finally {
      setEditingId(null);
      setIsSaving(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id: string) => {
    setIsSaving(true);
    try {
      const entry = entries.find((e) => e.id === id);
      const success = await deleteIndexEntry(id);
      if (success) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        addLog(`Smazána položka: ${entry?.code || id}`);
      }
    } catch (e) {
      console.error("Error deleting entry:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear all entries
  const handleClearAll = async () => {
    if (!confirm("Opravdu chcete smazat celý číselník?")) return;

    setIsSaving(true);
    try {
      const success = await deleteAllIndexEntries();
      if (success) {
        setEntries([]);
        addLog("Číselník byl vymazán");
      }
    } catch (e) {
      console.error("Error clearing entries:", e);
    } finally {
      setIsSaving(false);
    }
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
    // Reset phase state when new file is loaded
    setPhase('ready');
    setPhase1OutputBuffer(null);
    setPhase1Stats(null);
  };

  // Phase 1: Insert Oddíly column
  const handlePhase1 = async () => {
    if (!budgetFile) {
      alert("Nahrajte prosím soubor ke zpracování.");
      return;
    }

    setIsProcessing(true);
    setPhase('phase1-processing');
    setProgress({ percent: 0, label: "Zahajuji Fázi 1..." });
    setLogs([]);
    setSuccessInfo(null);

    try {
      addLog(`Fáze 1: Zpracovávám soubor: ${budgetFile.name}`);
      addLog("Vkládám sloupec Oddíly...");

      const buffer = await budgetFile.arrayBuffer();

      addLog(`Hledám "D" ve sloupci ${settings.markerColumn}, oddíly ze sloupce ${settings.sectionColumn}`);

      const result = await fillOddily(buffer, {
        markerColumn: settings.markerColumn,
        sectionColumn: settings.sectionColumn,
        onProgress: (percent, label) => setProgress({ percent, label }),
        onLog: addLog,
      });

      // Store output for Phase 2
      setPhase1OutputBuffer(result.outputBuffer);
      setPhase1Stats(result.stats);
      setPhase('phase1-done');

      addLog(`Fáze 1 dokončena: ${result.stats.sectionsFound} oddílů, ${result.stats.rowsFilled} řádků vyplněno`);

      setProgress({ percent: 100, label: "Fáze 1 dokončena!" });
    } catch (e: any) {
      console.error("Phase 1 error:", e);
      addLog(`CHYBA Fáze 1: ${e.message || "Neznámá chyba"}`);
      alert(`Chyba při zpracování Fáze 1: ${e.message || "Neznámá chyba"}`);
      setPhase('ready');
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Phase 2: Process file with indexer (uses Phase 1 output)
  const handleProcess = async () => {
    // Phase 2 requires Phase 1 to be complete
    if (!phase1OutputBuffer) {
      alert("Nejdříve spusťte Fázi 1 (vložení oddílů).");
      return;
    }
    if (entries.length === 0) {
      alert("Číselník je prázdný. Přidejte položky pro indexaci.");
      return;
    }

    setIsProcessing(true);
    setPhase('phase2-processing');
    setProgress({ percent: 0, label: "Zahajuji Fázi 2..." });
    setSuccessInfo(null);

    try {
      addLog(`Fáze 2: Indexace souboru`);
      addLog(
        `Sloupec s kódy: ${settings.codeColumn}, Sloupec pro popisy: ${settings.descColumn}`
      );

      // Use the output from Phase 1
      const indexMap = buildIndexMap();

      const result = await fillDescriptions(phase1OutputBuffer, indexMap, {
        codeColumn: settings.codeColumn,
        descColumn: settings.descColumn,
        createRecapitulation: settings.createRecapitulation,
        onProgress: (percent, label) => setProgress({ percent, label }),
        onLog: addLog,
      });

      // Download result
      const baseName = budgetFile?.name.replace(/\.(xlsx|xls)$/i, "") || "output";
      const outputName = `${baseName}_indexovano.xlsx`;

      const blob = new Blob([result.outputBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = outputName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 100);

      setPhase('phase2-done');
      setSuccessInfo({ outputName, stats: result.stats });
      addLog(`Soubor "${outputName}" byl stažen.`);
    } catch (e: any) {
      console.error("Phase 2 error:", e);
      addLog(`CHYBA Fáze 2: ${e.message || "Neznámá chyba"}`);
      alert(`Chyba při zpracování Fáze 2: ${e.message || "Neznámá chyba"}`);
      setPhase('phase1-done'); // Go back to phase 1 done state
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Phase 1 output only (without Phase 2)
  const handleDownloadPhase1 = () => {
    if (!phase1OutputBuffer || !budgetFile) return;

    const baseName = budgetFile.name.replace(/\.(xlsx|xls)$/i, "");
    const outputName = `${baseName}_oddily.xlsx`;

    const blob = new Blob([phase1OutputBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = outputName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);

    addLog(`Soubor "${outputName}" (pouze Fáze 1) byl stažen.`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-xl">
                join_inner
              </span>
            </div>
            Excel Indexer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Stvořitel výběrových řízení na základě porovnání dat a indexu
          </p>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${showSettings
            ? "bg-primary/20 text-primary"
            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            }`}
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>

      {/* Settings Panel - includes Číselník (codebook) */}
      {showSettings && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 animate-fadeIn space-y-4">
          {/* Phase 1 Settings */}
          <div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Fáze 1</span>
              Nastavení vkládání oddílů
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Sloupec s "D" markerem:
                </label>
                <select
                  value={settings.markerColumn}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, markerColumn: e.target.value }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-mono"
                >
                  {COLUMN_OPTIONS.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Sloupec s názvy oddílů:
                </label>
                <select
                  value={settings.sectionColumn}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, sectionColumn: e.target.value }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-mono"
                >
                  {COLUMN_OPTIONS.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              V originálním souboru: Hledá "D" ve sloupci {settings.markerColumn}, názvy oddílů ze sloupce {settings.sectionColumn}
            </p>
          </div>

          {/* Phase 2 Settings */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Fáze 2</span>
              Nastavení indexace
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Sloupec s kódy:
                </label>
                <select
                  value={settings.codeColumn}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, codeColumn: e.target.value }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-mono"
                >
                  {COLUMN_OPTIONS.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Sloupec pro popisy:
                </label>
                <select
                  value={settings.descColumn}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, descColumn: e.target.value }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-mono"
                >
                  {COLUMN_OPTIONS.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.createRecapitulation}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, createRecapitulation: e.target.checked }))
                  }
                  className="w-4 h-4 text-primary bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Vytvořit rekapitulaci VŘ
                </span>
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Po vložení oddílů: Kódy ze sloupce {settings.codeColumn}, popisy do sloupce {settings.descColumn}
            </p>
          </div>

          {/* Číselník Section - moved here */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">
                  menu_book
                </span>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                  Číselník
                </h3>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                  {entries.length} položek
                </span>
                {isSaving && (
                  <span className="text-xs text-primary animate-pulse">
                    Ukládám...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        handleImportExcel(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-sm">
                      upload
                    </span>
                    Import
                  </span>
                </label>
                {entries.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      delete
                    </span>
                    Vymazat
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="max-h-60 overflow-y-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Načítám číselník...</p>
                </div>
              ) : entries.length === 0 && !isAddingNew ? (
                <div className="p-6 text-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl mb-1 block">
                    table_rows
                  </span>
                  <p className="text-xs">Číselník je prázdný</p>
                  <p className="text-xs mt-0.5">
                    Importujte Excel nebo přidejte položky ručně
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">
                        Kód
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Popis
                      </th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        {editingId === entry.id ? (
                          <>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                defaultValue={entry.code}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-primary/50 rounded focus:ring-1 focus:ring-primary/50"
                                id={`edit-code-${entry.id}`}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                defaultValue={entry.description}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-primary/50 rounded focus:ring-1 focus:ring-primary/50"
                                id={`edit-desc-${entry.id}`}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const codeInput = document.getElementById(
                                      `edit-code-${entry.id}`
                                    ) as HTMLInputElement;
                                    const descInput = document.getElementById(
                                      `edit-desc-${entry.id}`
                                    ) as HTMLInputElement;
                                    handleUpdateEntry(
                                      entry.id,
                                      codeInput.value,
                                      descInput.value
                                    );
                                  }}
                                  disabled={isSaving}
                                  className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    check
                                  </span>
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    close
                                  </span>
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                              {entry.code}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">
                              {entry.description}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setEditingId(entry.id)}
                                  className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    edit
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  disabled={isSaving}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    delete
                                  </span>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}

                    {/* Add new row */}
                    {isAddingNew && (
                      <tr className="bg-primary/5">
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value)}
                            placeholder="Kód"
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-primary/50 rounded focus:ring-1 focus:ring-primary/50"
                            autoFocus
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="Popis"
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-primary/50 rounded focus:ring-1 focus:ring-primary/50"
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleAddEntry()
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleAddEntry}
                              disabled={isSaving}
                              className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">
                                check
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setIsAddingNew(false);
                                setNewCode("");
                                setNewDesc("");
                              }}
                              className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                              <span className="material-symbols-outlined text-sm">
                                close
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add button */}
            {!isAddingNew && !isLoading && (
              <button
                onClick={() => setIsAddingNew(true)}
                className="mt-2 w-full py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Přidat položku
              </button>
            )}
          </div>
        </div>
      )}

      {/* Processing Section */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">
            play_circle
          </span>
          <h2 className="font-bold text-slate-900 dark:text-white">
            Zpracování
          </h2>
          {/* Phase indicator */}
          {phase !== 'ready' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${phase.includes('phase1') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              phase.includes('phase2') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''
              }`}>
              {phase.includes('phase1') ? 'Fáze 1' : phase.includes('phase2') ? 'Fáze 2' : ''}
            </span>
          )}
        </div>

        {/* Description of functionality */}
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 mb-4 text-sm text-slate-600 dark:text-slate-400">
          <p className="mb-2">
            <strong className="text-slate-700 dark:text-slate-300">Dvoufázové zpracování rozpočtů:</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 text-xs">
            <div className="flex-1 flex gap-2">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold shrink-0">1</span>
              <p><strong>Oddíly</strong> – Vloží nový sloupec B s názvy oddílů (hledá "D" marker ve sloupci {settings.markerColumn})</p>
            </div>
            <div className="flex-1 flex gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold shrink-0">2</span>
              <p><strong>Indexace</strong> – Doplní popisy položek podle číselníku (kódy ze sloupce {settings.codeColumn})</p>
            </div>
          </div>
        </div>

        {/* File Drop Zone */}
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
              border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-4
              ${isBudgetDropActive
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5"
            }
            `}
          onClick={() =>
            document.getElementById("budget-upload-new")?.click()
          }
        >
          <input
            type="file"
            id="budget-upload-new"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files?.[0]) handleBudgetFile(e.target.files[0]);
            }}
          />

          {budgetFile ? (
            <div className="animate-fadeIn">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">
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
                  setPhase('ready');
                  setPhase1OutputBuffer(null);
                  setPhase1Stats(null);
                }}
                className="mt-2 text-red-400 hover:text-red-500 text-sm font-medium hover:underline"
              >
                Zrušit
              </button>
            </div>
          ) : (
            <div className="pointer-events-none">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
                upload_file
              </span>
              <div className="font-bold text-slate-700 dark:text-slate-200">
                Přetáhněte soubor ke zpracování
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Excel (.xlsx, .xls)
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        {progress && (
          <div className="mb-4 animate-fadeIn">
            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              <span>{progress.label}</span>
              <span>{Math.round(progress.percent)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase 1 Done Indicator */}
        {phase === 'phase1-done' && phase1Stats && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 animate-fadeIn">
            <span className="material-symbols-outlined text-blue-500 text-xl">
              check_circle
            </span>
            <div className="flex-1 text-sm">
              <div className="font-bold text-blue-700 dark:text-blue-400">
                Fáze 1 dokončena!
              </div>
              <div className="text-blue-600/80 dark:text-blue-400/80">
                Sloupec Oddíly byl vložen. Nalezeno {phase1Stats.sectionsFound} oddílů, vyplněno {phase1Stats.rowsFilled} řádků.
              </div>
              <button
                onClick={handleDownloadPhase1}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Stáhnout pouze s oddíly (bez indexace)
              </button>
            </div>
          </div>
        )}

        {/* Final Success */}
        {successInfo && (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-500 text-xl">
              check_circle
            </span>
            <div className="text-sm">
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                Hotovo!
              </div>
              <div className="text-emerald-600/80 dark:text-emerald-400/80">
                Soubor <strong>{successInfo.outputName}</strong> byl stažen.
              </div>
              {successInfo.stats && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {successInfo.stats.codesFound} kódů ·{" "}
                  {successInfo.stats.matchesFound} shod ·{" "}
                  {successInfo.stats.descriptionsWritten} zapsáno
                </div>
              )}
            </div>
          </div>
        )}

        {/* Two-Phase Buttons */}
        <div className="space-y-3">
          {/* Phase 1 Button */}
          {(phase === 'ready' || phase === 'phase1-processing') && (
            <button
              onClick={handlePhase1}
              disabled={!budgetFile || isProcessing}
              className={`
                  w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2
                  ${!budgetFile || isProcessing
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:scale-[1.02]"
                }
                `}
            >
              {isProcessing && phase === 'phase1-processing' ? (
                <>
                  <span className="animate-spin material-symbols-outlined">
                    sync
                  </span>
                  Vkládám oddíly...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">add_column_right</span>
                  Fáze 1: Vložit sloupec Oddíly
                </>
              )}
            </button>
          )}

          {/* Phase 2 Button - only visible after Phase 1 is done */}
          {(phase === 'phase1-done' || phase === 'phase2-processing' || phase === 'phase2-done') && (
            <button
              onClick={handleProcess}
              disabled={entries.length === 0 || !phase1OutputBuffer || isProcessing}
              className={`
                  w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2
                  ${entries.length === 0 || !phase1OutputBuffer || isProcessing
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-primary text-white hover:shadow-lg hover:scale-[1.02]"
                }
                `}
            >
              {isProcessing && phase === 'phase2-processing' ? (
                <>
                  <span className="animate-spin material-symbols-outlined">
                    sync
                  </span>
                  Indexuji...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">play_arrow</span>
                  Fáze 2: Spustit indexaci
                </>
              )}
            </button>
          )}

          {/* Helper text for Phase 2 */}
          {phase === 'phase1-done' && entries.length === 0 && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400">
              Pro Fázi 2 je potřeba vyplnit číselník (vlevo)
            </p>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-4 animate-fadeIn">
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
              className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs text-slate-300 space-y-0.5"
            >
              {logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExcelIndexerSettings;
