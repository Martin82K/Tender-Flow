import React, { useEffect, useMemo, useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from './StatusPill';
import { formatMoney, formatDate, formatPercent, addMonthsIso } from '../utils/format';
import { computeRetention } from '../utils/retention';

const COLUMN_STORAGE_KEY = 'tf.contracts.tableColumns.v1';

type ColumnId =
  | 'number'
  | 'vendor'
  | 'status'
  | 'total'
  | 'amendments'
  | 'invoiced'
  | 'paid'
  | 'retentionShort'
  | 'retentionLong'
  | 'warrantyEnd'
  | 'paymentTerms'
  | 'rating';

const DEFAULT_COLUMNS: ColumnId[] = [
  'number',
  'vendor',
  'status',
  'total',
  'amendments',
  'invoiced',
  'paid',
  'retentionShort',
  'retentionLong',
  'warrantyEnd',
  'paymentTerms',
  'rating',
];

const COLUMN_LABELS: Record<ColumnId, string> = {
  number: 'Č. smlouvy',
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

const COLUMN_ALIGN: Record<ColumnId, 'left' | 'right'> = {
  number: 'left',
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

const readColumnPrefs = (): ColumnId[] => {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c): c is ColumnId => c in COLUMN_LABELS);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_COLUMNS;
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
}

export const ContractsTable: React.FC<Props> = ({ contracts, onSelect }) => {
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(readColumnPrefs);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (col: ColumnId) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const columnsOrdered = useMemo(
    () => DEFAULT_COLUMNS.filter((c) => visibleColumns.includes(c)),
    [visibleColumns],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ⚙ Sloupce
          </button>
          {configOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-2 space-y-1">
              {DEFAULT_COLUMNS.map((col) => (
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
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {columnsOrdered.map((col) => (
                <th
                  key={col}
                  className={`sticky top-0 bg-slate-50 dark:bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold px-2.5 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap ${
                    COLUMN_ALIGN[col] === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {COLUMN_LABELS[col]}
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
                          <td key={col} className="px-2.5 py-2.5 font-semibold text-slate-900 dark:text-slate-200">
                            {c.contractNumber || '—'}
                            <div className="font-normal text-[11px] text-slate-600 dark:text-slate-500">{c.title}</div>
                          </td>
                        );
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
