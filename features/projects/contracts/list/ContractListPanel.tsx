import React, { useMemo, useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from './StatusPill';
import { ContractFilters, applyContractFilter, type ContractFilterKey } from './ContractFilters';
import { formatMoney } from '../utils/format';

interface Props {
  contracts: ContractWithDetails[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ContractListPanel: React.FC<Props> = ({ contracts, selectedId, onSelect }) => {
  const [filter, setFilter] = useState<ContractFilterKey>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('cs');
    return contracts.filter((c) => {
      if (!applyContractFilter(c, filter)) return false;
      if (!q) return true;
      return (
        (c.title || '').toLocaleLowerCase('cs').includes(q) ||
        (c.vendorName || '').toLocaleLowerCase('cs').includes(q) ||
        (c.contractNumber || '').toLocaleLowerCase('cs').includes(q)
      );
    });
  }, [contracts, filter, query]);

  return (
    <aside className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-base">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat smlouvu / dodavatele…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder-slate-500 dark:text-slate-200 dark:placeholder-slate-600"
          />
        </div>
        <ContractFilters active={filter} onChange={setFilter} counts={{ all: visible.length }} />
      </div>

      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600 dark:text-slate-500">
            Žádné smlouvy pro zvolený filtr.
          </div>
        ) : (
          visible.map((c) => {
            const pct =
              c.currentTotal > 0
                ? Math.min(100, Math.round((c.invoicedSum / c.currentTotal) * 100))
                : 0;
            const isActive = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full text-left p-3 border-b border-slate-200 dark:border-slate-800 transition ${
                  isActive
                    ? 'bg-primary/10 border-l-[3px] border-l-primary pl-[9px]'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{c.title}</div>
                    {c.contractNumber && (
                      <div className="text-[10.5px] text-slate-600 dark:text-slate-500">{c.contractNumber}</div>
                    )}
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">{c.vendorName}</div>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="font-semibold text-slate-900 dark:text-slate-200 tabular-nums">
                    {formatMoney(c.currentTotal, c.currency)}
                  </span>
                  <span className="text-slate-600 dark:text-slate-500">
                    {c.amendments.length > 0 ? `+${c.amendments.length} dodatků ` : ''}
                    {c.overdueSum > 0 && (
                      <span className="inline-block rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                        po splat.
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <span
                    className="block h-full bg-gradient-to-r from-amber-500 to-green-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10.5px] text-slate-600 dark:text-slate-500 mt-0.5">Nafakturováno {pct} %</div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
