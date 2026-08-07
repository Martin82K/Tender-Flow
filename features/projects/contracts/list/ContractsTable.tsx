import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from './StatusPill';
import { formatMoney, formatDate, formatPercent, addMonthsIso } from '../utils/format';
import { computeRetention } from '../utils/retention';
import {
  CONTRACT_COLUMN_IDS,
  defaultContractTablePreferences,
  parseContractTablePreferences,
  resizeContractColumn,
  type ContractColumnId,
  type ContractTablePreferences,
} from './contractTablePreferences';

const COLUMN_STORAGE_KEY = 'tf.contracts.tableColumns.v2';
const LEGACY_COLUMN_STORAGE_KEY = 'tf.contracts.tableColumns.v1';

const COLUMN_LABELS: Record<ContractColumnId, string> = {
  number: 'Č. smlouvy',
  document: 'Dokument',
  vendor: 'Dodavatel',
  status: 'Stav',
  total: 'Hodnota',
  amendments: '+Dodatky',
  invoiced: 'Nafakt.',
  paid: 'Zapl.',
  retentionShort: 'Poz. krátk.',
  retentionLong: 'Poz. dlouh.',
  warrantyEnd: 'Záruka do',
  paymentTerms: 'Splatnost',
  rating: 'Hodnocení',
};

const COLUMN_ALIGN: Record<ContractColumnId, 'left' | 'right'> = {
  number: 'left',
  document: 'left',
  vendor: 'left',
  status: 'left',
  total: 'right',
  amendments: 'right',
  invoiced: 'right',
  paid: 'right',
  retentionShort: 'right',
  retentionLong: 'right',
  warrantyEnd: 'left',
  paymentTerms: 'right',
  rating: 'left',
};

const readColumnPrefs = (): ContractTablePreferences => {
  if (typeof window === 'undefined') return defaultContractTablePreferences();
  return parseContractTablePreferences(
    window.localStorage.getItem(COLUMN_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_COLUMN_STORAGE_KEY),
  );
};

const renderStars = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const full = '★'.repeat(Math.round(value));
  const empty = '☆'.repeat(Math.max(0, 5 - Math.round(value)));
  return full + empty;
};

interface Props {
  contracts: ContractWithDetails[];
  onSelect: (id: string) => void;
  onOpenDocument?: (contract: ContractWithDetails) => Promise<void> | void;
}

export const ContractsTable: React.FC<Props> = ({ contracts, onSelect, onOpenDocument }) => {
  const [preferences, setPreferences] = useState<ContractTablePreferences>(readColumnPrefs);
  const [configOpen, setConfigOpen] = useState(false);
  const resizeRef = useRef<{
    column: ContractColumnId;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const width = resizeContractColumn(
        resize.column,
        resize.startWidth + event.clientX - resize.startX,
      );
      setPreferences((current) => ({
        ...current,
        widths: { ...current.widths, [resize.column]: width },
      }));
    };
    const handlePointerUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const visibleColumns = preferences.visibleColumns;

  const toggleColumn = (col: ContractColumnId) => {
    setPreferences((current) => ({
      ...current,
      visibleColumns: current.visibleColumns.includes(col)
        ? current.visibleColumns.filter((candidate) => candidate !== col)
        : [...current.visibleColumns, col],
    }));
  };

  const columnsOrdered = useMemo(
    () => CONTRACT_COLUMN_IDS.filter((c) => visibleColumns.includes(c)),
    [visibleColumns],
  );
  const tableWidth = columnsOrdered.reduce(
    (sum, column) => sum + preferences.widths[column],
    0,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <div data-help-id="contracts-table-columns" className="relative">
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ⚙ Sloupce
          </button>
          {configOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-2 space-y-1">
              {CONTRACT_COLUMN_IDS.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="accent-primary"
                  />
                  {COLUMN_LABELS[col]}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setPreferences(defaultContractTablePreferences())}
                className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-primary/10"
              >
                Obnovit výchozí šířky
              </button>
            </div>
          )}
        </div>
      </div>

      <div data-help-id="contracts-table" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-auto">
        <table className="table-fixed text-xs" style={{ width: tableWidth }}>
          <colgroup>
            {columnsOrdered.map((column) => (
              <col key={column} style={{ width: preferences.widths[column] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columnsOrdered.map((col) => (
                <th
                  key={col}
                  className={`group relative sticky top-0 bg-slate-50 dark:bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold px-2.5 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap ${
                    COLUMN_ALIGN[col] === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {COLUMN_LABELS[col]}
                  <span
                    role="separator"
                    aria-label={`Změnit šířku sloupce ${COLUMN_LABELS[col]}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      resizeRef.current = {
                        column: col,
                        startX: event.clientX,
                        startWidth: preferences.widths[col],
                      };
                      document.body.style.cursor = 'col-resize';
                      document.body.style.userSelect = 'none';
                    }}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-primary group-hover:bg-primary/5"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => {
              const retention = computeRetention(c);
              const amendmentsDelta = (c.currentTotal || 0) - (c.basePrice || 0);
              const warrantyEnd = addMonthsIso(c.signedAt, c.warrantyMonths ?? null);
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className="cursor-pointer border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  {columnsOrdered.map((col) => {
                    switch (col) {
                      case 'number':
                        return (
                          <td key={col} className="px-2.5 py-2.5 font-semibold whitespace-normal text-slate-900 dark:text-slate-200 [overflow-wrap:anywhere]">
                            <span>{c.contractNumber || '—'}</span>
                            <div className="font-normal text-[11px] whitespace-normal break-words text-slate-600 dark:text-slate-500 [overflow-wrap:anywhere]">{c.title}</div>
                          </td>
                        );
                      case 'document': {
                        const hasDocument = Boolean(c.documentStoragePath || c.documentUrl);
                        const isPdf = c.documentMimeType === 'application/pdf'
                          || c.documentFileName?.toLowerCase().endsWith('.pdf');
                        return (
                          <td key={col} className="px-2.5 py-2.5">
                            {hasDocument ? (
                              <button
                                type="button"
                                title={c.documentFileName || 'Otevřít dokument'}
                                aria-label={`Otevřít dokument ${c.documentFileName || c.title}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onOpenDocument?.(c);
                                }}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${
                                  isPdf
                                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                                    : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[15px]">description</span>
                                {isPdf ? 'PDF' : 'DOCX'}
                              </button>
                            ) : '—'}
                          </td>
                        );
                      }
                      case 'vendor':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-slate-700 dark:text-slate-300">
                            {c.vendorName}
                          </td>
                        );
                      case 'status':
                        return (
                          <td key={col} className="px-2.5 py-2.5">
                            <StatusPill status={c.status} />
                          </td>
                        );
                      case 'total':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right font-semibold tabular-nums">
                            {formatMoney(c.currentTotal, c.currency)}
                          </td>
                        );
                      case 'amendments':
                        return (
                          <td
                            key={col}
                            className={`px-2.5 py-2.5 text-right tabular-nums ${
                              amendmentsDelta > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-500'
                            }`}
                          >
                            {amendmentsDelta > 0
                              ? `+${formatMoney(amendmentsDelta, c.currency)}`
                              : '—'}
                          </td>
                        );
                      case 'invoiced':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right text-blue-400 tabular-nums">
                            {c.invoicedSum > 0 ? formatMoney(c.invoicedSum, c.currency) : '—'}
                          </td>
                        );
                      case 'paid':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right text-green-400 tabular-nums">
                            {c.paidSum > 0 ? formatMoney(c.paidSum, c.currency) : '—'}
                          </td>
                        );
                      case 'retentionShort':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right text-blue-400 tabular-nums">
                            {retention.shortPercent > 0
                              ? `${formatPercent(retention.shortPercent)} · ${formatMoney(retention.shortAmount, c.currency)}`
                              : '—'}
                          </td>
                        );
                      case 'retentionLong':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right text-purple-400 tabular-nums">
                            {retention.longPercent > 0
                              ? `${formatPercent(retention.longPercent)} · ${formatMoney(retention.longAmount, c.currency)}`
                              : '—'}
                          </td>
                        );
                      case 'warrantyEnd':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-slate-700 dark:text-slate-300">
                            {formatDate(warrantyEnd)}
                          </td>
                        );
                      case 'paymentTerms':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                            {c.paymentTerms || '—'}
                          </td>
                        );
                      case 'rating':
                        return (
                          <td key={col} className="px-2.5 py-2.5 text-amber-400 tracking-widest">
                            {renderStars(c.vendorRating ?? null)}
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
