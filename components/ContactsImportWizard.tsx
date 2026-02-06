import React from "react";
import type { StatusConfig, Subcontractor } from "../types";
import {
  analyzeContactsImport,
  buildCorrectedWorkbook,
  buildTemplateWorkbook,
  downloadWorkbook,
  getTenderFlowImportFields,
  parseContactsImportSource,
  suggestFieldMapping,
  type AnalyzeResult,
  type ContactsImportSource,
  type FieldMapping,
  type ParsedTable,
  type RowOutcome,
  type TFFieldKey,
} from "../services/contactsImportWizardService";

type WizardStep = "source" | "mapping" | "preview" | "done";

const OUTCOME_META: Record<RowOutcome, { label: string; className: string }> = {
  imported: { label: "Importováno", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  imported_with_warning: {
    label: "S varováním",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  not_imported: { label: "Neimportováno", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const STEP_LABELS: Array<{ key: WizardStep; label: string }> = [
  { key: "source", label: "1) Soubor / URL" },
  { key: "mapping", label: "2) Mapování" },
  { key: "preview", label: "3) Náhled" },
  { key: "done", label: "4) Import" },
];

export interface ContactsImportWizardProps {
  contacts: Subcontractor[];
  statuses: StatusConfig[];
  defaultStatusId?: string;
  onImportContacts: (contacts: Subcontractor[], onProgress?: (percent: number) => void) => Promise<void>;
}

export const ContactsImportWizard: React.FC<ContactsImportWizardProps> = ({
  contacts,
  statuses,
  defaultStatusId = "available",
  onImportContacts,
}) => {
  const fields = React.useMemo(() => getTenderFlowImportFields(), []);
  const [step, setStep] = React.useState<WizardStep>("source");

  const [sourceKind, setSourceKind] = React.useState<"file" | "url">("file");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [table, setTable] = React.useState<ParsedTable | null>(null);
  const [mapping, setMapping] = React.useState<FieldMapping | null>(null);
  const [analysis, setAnalysis] = React.useState<AnalyzeResult | null>(null);

  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importError, setImportError] = React.useState<string | null>(null);

  const [outcomeFilter, setOutcomeFilter] = React.useState<RowOutcome | "all">("all");

  const resetAll = () => {
    setLoadError(null);
    setImportError(null);
    setIsLoading(false);
    setIsImporting(false);
    setImportProgress(0);
    setTable(null);
    setMapping(null);
    setAnalysis(null);
    setOutcomeFilter("all");
    setStep("source");
  };

  const buildSource = (): ContactsImportSource | null => {
    if (sourceKind === "file") {
      if (!sourceFile) return null;
      return { kind: "file", file: sourceFile };
    }
    if (!sourceUrl.trim()) return null;
    return { kind: "url", url: sourceUrl.trim() };
  };

  const loadSource = async () => {
    const source = buildSource();
    if (!source) {
      setLoadError(sourceKind === "file" ? "Vyberte soubor CSV/XLSX." : "Zadejte URL souboru CSV/XLSX.");
      return;
    }
    setLoadError(null);
    setIsLoading(true);
    setImportError(null);
    try {
      const parsed = await parseContactsImportSource(source);
      const suggested = suggestFieldMapping(parsed.headers);
      setTable(parsed);
      setMapping(suggested);
      setAnalysis(
        analyzeContactsImport(parsed, suggested, {
          defaultStatusId,
          statuses,
          existingContacts: contacts,
        })
      );
      setStep("mapping");
    } catch (e: any) {
      setLoadError(e?.message || "Nepodařilo se načíst soubor.");
    } finally {
      setIsLoading(false);
    }
  };

  const recalcAnalysis = React.useCallback(
    (nextMapping: FieldMapping) => {
      if (!table) return;
      const next = analyzeContactsImport(table, nextMapping, {
        defaultStatusId,
        statuses,
        existingContacts: contacts,
      });
      setAnalysis(next);
    },
    [contacts, defaultStatusId, statuses, table]
  );

  const updateMapping = (key: TFFieldKey, header: string | null) => {
    if (!mapping) return;
    const next: FieldMapping = { ...mapping, [key]: header };
    setMapping(next);
    recalcAnalysis(next);
  };

  const autoMap = () => {
    if (!table) return;
    const next = suggestFieldMapping(table.headers);
    setMapping(next);
    recalcAnalysis(next);
  };

  const proceedToPreview = () => {
    if (!analysis) return;
    setOutcomeFilter("all");
    setStep("preview");
  };

  const confirmImport = async () => {
    if (!analysis) return;
    setIsImporting(true);
    setImportError(null);
    setImportProgress(0);
    try {
      await onImportContacts(analysis.aggregatedContacts, (p) => setImportProgress(p));
      setStep("done");
    } catch (e: any) {
      setImportError(e?.message || "Import selhal.");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadCorrected = () => {
    if (!table || !analysis) return;
    const wb = buildCorrectedWorkbook(table, analysis);
    const safeBase = (table.sourceLabel || "import").replace(/[^\w.-]+/g, "_").slice(0, 50);
    downloadWorkbook(wb, `tenderflow_import_${safeBase}.xlsx`);
  };

  const downloadTemplate = () => {
    const wb = buildTemplateWorkbook();
    downloadWorkbook(wb, "tenderflow_sablona_kontakty.xlsx");
  };

  const filteredRows = React.useMemo(() => {
    if (!analysis) return [];
    if (outcomeFilter === "all") return analysis.rows;
    return analysis.rows.filter((r) => r.outcome === outcomeFilter);
  }, [analysis, outcomeFilter]);

  const canContinueFromMapping = !!table && !!mapping && !!analysis;
  const canImport = !!analysis && analysis.aggregatedContacts.length > 0 && !isImporting;

  return (
    <div className="space-y-6">
      {/* Header + Steps */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Průvodce importem kontaktů</h3>
            <p className="text-xs text-slate-500 mt-1">
              Import je tolerantní: minimum je <span className="font-semibold">firma nebo email</span>. Neúplná data
              raději importujeme a označíme varováním.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              title="Stáhnout šablonu pro další importy"
            >
              Export šablony
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STEP_LABELS.map((s) => (
            <span
              key={s.key}
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                step === s.key
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step: Source */}
      {step === "source" && (
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSourceKind("file")}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                sourceKind === "file"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              Soubor (CSV/XLSX)
            </button>
            <button
              type="button"
              onClick={() => setSourceKind("url")}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                sourceKind === "url"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              URL (CSV/XLSX)
            </button>
          </div>

          {sourceKind === "file" ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500 font-medium">Soubor</label>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-slate-500">folder_open</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {sourceFile?.name || "Vybrat soubor"}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">Podpora: CSV, XLSX</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500 font-medium">URL souboru</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/.../export?format=csv"
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-slate-500">
                Tip: u Google Sheets použijte export link (např. <span className="font-mono">?format=csv</span>).
              </p>
            </div>
          )}

          {loadError && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {loadError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Načteme soubor, analyzujeme hlavičky a navrhneme mapování na Tender Flow pole.
            </div>
            <button
              type="button"
              onClick={loadSource}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Načítám…" : "Pokračovat"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && table && mapping && analysis && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Analýza souboru</p>
                <p className="text-xs text-slate-500 mt-1">
                  Zdroj: <span className="font-mono">{table.sourceLabel}</span> · Řádků:{" "}
                  <span className="font-semibold">{table.rows.length}</span> · Sloupců:{" "}
                  <span className="font-semibold">{table.headers.length}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoMap}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Auto-map
                </button>
                <button
                  type="button"
                  onClick={() => setStep("source")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Zpět
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Mapování sloupců</p>
                <p className="text-xs text-slate-500 mt-1">
                  Upravte mapování dle vaší šablony. Povinné minimum: <span className="font-semibold">firma nebo email</span>.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {analysis.aggregatedContacts.length} firem po sloučení
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{f.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{f.hint}</p>
                    </div>
                    <select
                      value={mapping[f.key] || ""}
                      onChange={(e) => updateMapping(f.key, e.target.value ? e.target.value : null)}
                      className="rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="">Nemapovat</option>
                      {table.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  Import: {analysis.counts.imported}
                </span>
                <span className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  Varování: {analysis.counts.importedWithWarning}
                </span>
                <span className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  Neimport.: {analysis.counts.notImported}
                </span>
              </div>
              <button
                type="button"
                onClick={proceedToPreview}
                disabled={!canContinueFromMapping}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pokračovat na náhled
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && table && mapping && analysis && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Náhled výsledku před importem</p>
                <p className="text-xs text-slate-500 mt-1">
                  Zkontrolujte varování a neimportované řádky. Import proběhne na úrovni firem (řádky se sloučí podle firmy).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Zpět na mapování
                </button>
                <button
                  type="button"
                  onClick={downloadCorrected}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  title="Stáhnout soubor s doplněnými outcome/warnings/errors sloupci"
                >
                  Stáhnout upravený Excel
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOutcomeFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  outcomeFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                Vše ({analysis.rows.length})
              </button>
              {(["imported", "imported_with_warning", "not_imported"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcomeFilter(o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    outcomeFilter === o
                      ? OUTCOME_META[o].className
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {OUTCOME_META[o].label} (
                  {o === "imported"
                    ? analysis.counts.imported
                    : o === "imported_with_warning"
                      ? analysis.counts.importedWithWarning
                      : analysis.counts.notImported}
                  )
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-bold">Řádek</th>
                    <th className="px-4 py-3 font-bold">Firma</th>
                    <th className="px-4 py-3 font-bold">Kontakt</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Telefon</th>
                    <th className="px-4 py-3 font-bold">Výsledek</th>
                    <th className="px-4 py-3 font-bold">Poznámky</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.slice(0, 200).map((r) => (
                    <tr key={r.rowIndex} className="text-sm">
                      <td className="px-4 py-3 text-slate-500 font-mono">{r.rowIndex}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{r.mapped.company || "-"}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{r.mapped.contactName || "-"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.mapped.contactEmail || "-"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.mapped.contactPhone || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold border ${OUTCOME_META[r.outcome].className}`}
                        >
                          {OUTCOME_META[r.outcome].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.errors.length > 0 ? (
                          <span className="text-red-600">{r.errors.join(" · ")}</span>
                        ) : r.warnings.length > 0 ? (
                          <span className="text-amber-600">{r.warnings.join(" · ")}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
              Zobrazeno {Math.min(filteredRows.length, 200)} z {filteredRows.length} řádků.
            </div>
          </div>

          {importError && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {importError}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-xs text-slate-500">
                K importu: <span className="font-semibold">{analysis.aggregatedContacts.length}</span> firem (sloučeno z{" "}
                {analysis.rows.length} řádků)
              </div>
              <button
                type="button"
                onClick={confirmImport}
                disabled={!canImport}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Importovat do databáze
              </button>
            </div>

            {isImporting && (
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }} />
                </div>
                <span className="text-sm font-bold text-primary whitespace-nowrap">{importProgress}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && analysis && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Import dokončen</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1">
                Zpracováno {analysis.rows.length} řádků, sloučeno do {analysis.aggregatedContacts.length} firem.
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1">
                Budoucí rozšíření: historie importů a AI obohacení (připraveno na PRO modul).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadCorrected}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300/60 dark:border-emerald-700 bg-white/70 dark:bg-slate-900 hover:bg-white transition-colors"
              >
                Stáhnout upravený Excel
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300/60 dark:border-emerald-700 bg-white/70 dark:bg-slate-900 hover:bg-white transition-colors"
              >
                Nový import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

