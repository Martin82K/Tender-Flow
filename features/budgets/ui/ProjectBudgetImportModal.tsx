import React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Modal } from "@/shared/ui/Modal";
import type {
  BudgetImportColumnField,
  BudgetImportColumnOverrides,
  ParsedBudgetImport,
} from "../api";
import { formatBudgetCurrency } from "../model/budgetFormat";

const IMPORT_COLUMN_LABELS: Array<[BudgetImportColumnField, string]> = [
  ["order", "P.č."],
  ["code", "Kód"],
  ["name", "Název"],
  ["unit", "MJ"],
  ["amount", "Množství"],
  ["unitPrice", "J. cena"],
  ["category", "Kapitola"],
  ["vatRate", "DPH"],
];

const columnLetter = (index: number): string => {
  if (!Number.isInteger(index) || index < 0) return "";
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const numberText = (value: number) =>
  value.toLocaleString("cs-CZ", {
    maximumFractionDigits: 4,
  });

const skippedReasonSummary = (preview: ParsedBudgetImport | null): Array<{ reason: string; count: number }> => {
  if (!preview) return [];
  const counts = new Map<string, number>();
  preview.skippedRowDetails.forEach((row) => {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  });
  return Array.from(counts, ([reason, count]) => ({ reason, count }));
};

interface ProjectBudgetImportModalProps {
  isOpen: boolean;
  preview: ParsedBudgetImport | null;
  columnOverrides: BudgetImportColumnOverrides;
  isParsing: boolean;
  isImporting: boolean;
  error: string | null;
  onRemapColumn: (field: BudgetImportColumnField, value: number) => void;
  onResetMapping: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ProjectBudgetImportModal: React.FC<ProjectBudgetImportModalProps> = ({
  isOpen,
  preview,
  columnOverrides,
  isParsing,
  isImporting,
  error,
  onRemapColumn,
  onResetMapping,
  onConfirm,
  onCancel,
}) => {
  const hasOverrides = Object.keys(columnOverrides).length > 0;
  const canImport = !!preview && preview.rows.length > 0 && !isParsing && !isImporting;
  const skippedSummary = skippedReasonSummary(preview);
  const skippedRowsWithoutDetail = preview
    ? Math.max(0, preview.skippedRows - preview.skippedRowDetails.length)
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Import rozpočtu z Excelu"
      description="Zkontrolujte rozpoznané sloupce a náhled položek před uložením do rozpočtu."
      size="2xl"
      persistent={isParsing || isImporting}
    >
      <div className="space-y-4 text-[var(--tf-skin-text)]">
        {preview && (
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="min-w-0 border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">Soubor</div>
              <div className="mt-1 truncate text-xs font-black">{preview.fileName}</div>
            </div>
            <div className="min-w-0 border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">Položek</div>
              <div className="mt-1 font-mono text-sm font-black">{preview.rows.length.toLocaleString("cs-CZ")}</div>
            </div>
            <div className="min-w-0 border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">Listů</div>
              <div className="mt-1 font-mono text-sm font-black">{preview.sheetNames.length.toLocaleString("cs-CZ")}</div>
            </div>
            <div className="min-w-0 border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">Přeskočeno</div>
              <div className="mt-1 font-mono text-sm font-black">{preview.skippedRows.toLocaleString("cs-CZ")}</div>
            </div>
          </div>
        )}

        {preview && (
          <div className="border border-[var(--tf-skin-line)]">
            <div className="flex items-center justify-between border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
                Mapování sloupců
                {preview.headerSheetName ? ` · ${preview.headerSheetName}` : ""}
                {preview.headerRowNumber ? ` · řádek ${preview.headerRowNumber}` : ""}
              </div>
              <div className="flex items-center gap-2">
                {isParsing && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--tf-skin-muted)]">
                    <Loader2 className="size-3 animate-spin" />
                    Přepočítávám
                  </span>
                )}
                {hasOverrides && (
                  <button
                    type="button"
                    onClick={onResetMapping}
                    disabled={isParsing || isImporting}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-muted)] hover:text-[var(--tf-skin-orange)] disabled:opacity-40"
                  >
                    <RotateCcw className="size-3" />
                    Obnovit auto-detekci
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
              {IMPORT_COLUMN_LABELS.map(([field, label]) => {
                const currentIndex = preview.mappedColumnIndices[field];
                const selectValue = currentIndex === undefined ? "" : String(currentIndex);
                const isOverridden = columnOverrides[field] !== undefined;

                return (
                  <label key={field} className="space-y-1">
                    <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-muted)]">
                      {label}
                      {isOverridden && <span className="ml-1 text-[var(--tf-skin-orange)]">(ručně)</span>}
                    </span>
                    <select
                      value={selectValue}
                      disabled={isParsing || isImporting || preview.headerRow.length === 0}
                      onChange={(event) => onRemapColumn(field, event.target.value === "" ? -1 : Number(event.target.value))}
                      className="h-8 w-full border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-2 font-mono text-[10px] outline-none focus:border-[var(--tf-skin-orange)] disabled:opacity-50"
                    >
                      <option value="">bez sloupce</option>
                      {preview.headerRow.map((header, index) => {
                        const headerLabel = header.trim() || "(prázdné)";
                        return (
                          <option key={`${index}-${headerLabel}`} value={index}>
                            {columnLetter(index)} · {headerLabel.length > 44 ? `${headerLabel.slice(0, 44)}...` : headerLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {preview && (
          <div className="border border-[var(--tf-skin-line)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
                Přehled neimportovaných řádků
              </div>
              <div className="font-mono text-[11px] font-black text-[var(--tf-skin-text)]">
                {preview.skippedRows.toLocaleString("cs-CZ")} přeskočeno
              </div>
            </div>
            {preview.skippedRows === 0 ? (
              <div className="px-3 py-3 text-[11px] font-semibold text-[var(--tf-skin-muted)]">
                V preview nejsou žádné přeskočené řádky.
              </div>
            ) : (
              <div className="space-y-3 p-3">
                {skippedSummary.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skippedSummary.map((item) => (
                      <div
                        key={item.reason}
                        className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-900"
                      >
                        {item.count.toLocaleString("cs-CZ")}x {item.reason}
                      </div>
                    ))}
                    {skippedRowsWithoutDetail > 0 && (
                      <div className="border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--tf-skin-muted)]">
                        {skippedRowsWithoutDetail.toLocaleString("cs-CZ")}x bez detailu
                      </div>
                    )}
                  </div>
                )}
                {preview.skippedRowDetails.length > 0 ? (
                  <div className="max-h-44 overflow-auto border border-[var(--tf-skin-line)]">
                    <table className="min-w-[900px] w-full text-left text-[10px]">
                      <thead className="sticky top-0 bg-[var(--tf-skin-card)] text-[8px] uppercase tracking-[0.12em] text-[var(--tf-skin-muted)]">
                        <tr>
                          <th className="w-20 border-b border-[var(--tf-skin-line)] px-2 py-2">Řádek</th>
                          <th className="w-28 border-b border-[var(--tf-skin-line)] px-2 py-2">List</th>
                          <th className="w-72 border-b border-[var(--tf-skin-line)] px-2 py-2">Důvod</th>
                          <th className="border-b border-[var(--tf-skin-line)] px-2 py-2">Hodnoty v řádku</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.skippedRowDetails.map((row, index) => (
                          <tr key={`${row.sheetName}-${row.rowNumber}-${index}`} className="border-b border-[var(--tf-skin-line)]">
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[var(--tf-skin-muted)]">{row.rowNumber}</td>
                            <td className="max-w-28 truncate px-2 py-1.5 font-mono">{row.sheetName}</td>
                            <td className="px-2 py-1.5 font-bold text-amber-900">{row.reason}</td>
                            <td className="max-w-[420px] truncate px-2 py-1.5 font-mono text-[var(--tf-skin-text-2)]">
                              {row.values.length > 0 ? row.values.join(" | ") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2 text-[11px] font-semibold text-[var(--tf-skin-muted)]">
                    Přeskočené řádky byly technické nebo prázdné a nemají další detail k zobrazení.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {preview && (
          <div className="overflow-hidden border border-[var(--tf-skin-line)]">
            <div className="border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
              Náhled položek
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="min-w-[1180px] w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-[var(--tf-skin-card)] text-[8px] uppercase tracking-[0.12em] text-[var(--tf-skin-muted)]">
                  <tr>
                    <th className="w-16 border-b border-[var(--tf-skin-line)] px-2 py-2">Řádek</th>
                    <th className="w-24 border-b border-[var(--tf-skin-line)] px-2 py-2">List</th>
                    <th className="w-16 border-b border-[var(--tf-skin-line)] px-2 py-2">P.č.</th>
                    <th className="w-56 border-b border-[var(--tf-skin-line)] px-2 py-2">Kapitola</th>
                    <th className="w-32 border-b border-[var(--tf-skin-line)] px-2 py-2">Kód</th>
                    <th className="border-b border-[var(--tf-skin-line)] px-2 py-2">Název</th>
                    <th className="w-16 border-b border-[var(--tf-skin-line)] px-2 py-2 text-right">MJ</th>
                    <th className="w-28 border-b border-[var(--tf-skin-line)] px-2 py-2 text-right">Množství</th>
                    <th className="w-28 border-b border-[var(--tf-skin-line)] px-2 py-2 text-right">J. cena</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 40).map((row) => (
                    <tr key={`${row.sheetName}-${row.sourceRowNumber}-${row.code}`} className="border-b border-[var(--tf-skin-line)]">
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[var(--tf-skin-muted)]">{row.sourceRowNumber}</td>
                      <td className="max-w-24 truncate px-2 py-1.5">{row.sheetName}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[var(--tf-skin-muted)]">{row.positionLabel || "-"}</td>
                      <td className="max-w-56 truncate px-2 py-1.5">{row.categoryName}</td>
                      <td className="max-w-32 truncate px-2 py-1.5 font-mono text-[var(--tf-skin-muted)]">{row.code || "-"}</td>
                      <td className="max-w-[420px] truncate px-2 py-1.5 font-bold">{row.name}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono font-black">{row.unit}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-[var(--tf-skin-green)]">{numberText(row.amount)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">{formatBudgetCurrency(row.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 40 && (
              <div className="bg-[var(--tf-skin-surface)] px-3 py-2 text-[10px] text-[var(--tf-skin-muted)]">
                Zobrazeno prvních 40 položek.
              </div>
            )}
          </div>
        )}

        {preview?.warnings.length ? (
          <div className="border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
            {preview.warnings.slice(0, 4).map((warning, index) => (
              <p key={`${warning}-${index}`}>{warning}</p>
            ))}
          </div>
        ) : null}

        {error && (
          <div className="border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--tf-skin-line)] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isParsing || isImporting}
            className="h-8 border border-[var(--tf-skin-line-2)] px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-text-2)] hover:border-[var(--tf-skin-text)] disabled:opacity-40"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canImport}
            className="inline-flex h-8 items-center gap-2 border border-[var(--tf-skin-orange)] bg-[var(--tf-skin-orange)] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-[var(--tf-skin-orange-deep)] disabled:border-[var(--tf-skin-line-2)] disabled:bg-[var(--tf-skin-line-2)] disabled:text-[var(--tf-skin-muted)]"
          >
            {isImporting && <Loader2 className="size-3.5 animate-spin" />}
            Importovat Excel
          </button>
        </div>
      </div>
    </Modal>
  );
};
