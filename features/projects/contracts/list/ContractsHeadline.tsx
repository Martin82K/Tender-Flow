import React, { useMemo } from 'react';
import type { ContractWithDetails } from '@/types';
import { formatMoney, daysUntil } from '../utils/format';
import { sumProjectRetention } from '../utils/retention';

interface Props {
  contracts: ContractWithDetails[];
}

export const ContractsHeadline: React.FC<Props> = ({ contracts }) => {
  const stats = useMemo(() => {
    let contractTotal = 0;
    let basePriceTotal = 0;
    let amendmentDelta = 0;
    let invoiced = 0;
    let paid = 0;
    let overdue = 0;
    for (const c of contracts) {
      contractTotal += c.currentTotal || 0;
      basePriceTotal += c.basePrice || 0;
      amendmentDelta += (c.currentTotal || 0) - (c.basePrice || 0);
      invoiced += c.invoicedSum || 0;
      paid += c.paidSum || 0;
      overdue += c.overdueSum || 0;
    }
    const { shortTotal, longTotal } = sumProjectRetention(contracts);
    return {
      contractTotal,
      basePriceTotal,
      amendmentDelta,
      invoiced,
      paid,
      overdue,
      shortTotal,
      longTotal,
    };
  }, [contracts]);

  const alerts = useMemo(() => {
    const items: { text: string; color: 'red' | 'amber' | 'blue' | 'green' }[] = [];
    for (const c of contracts) {
      for (const inv of c.invoices || []) {
        const dueIn = daysUntil(inv.dueDate);
        if (inv.status === 'overdue' || (inv.status === 'issued' && dueIn !== null && dueIn < 0)) {
          items.push({
            text: `Faktura ${inv.invoiceNumber} je ${Math.abs(dueIn ?? 0)} dní po splatnosti`,
            color: 'red',
          });
        } else if (inv.status === 'issued' && dueIn !== null && dueIn >= 0 && dueIn <= 14) {
          items.push({
            text: `Splatnost ${inv.invoiceNumber} za ${dueIn} dní`,
            color: 'amber',
          });
        }
      }
      if (c.retentionShortStatus !== 'released' && c.retentionShortReleaseOn) {
        const d = daysUntil(c.retentionShortReleaseOn);
        if (d !== null && d >= 0 && d <= 14) {
          items.push({
            text: `Uvolnění poz. krátk. · ${c.title} · za ${d} dní`,
            color: 'amber',
          });
        }
      }
    }
    return items.slice(0, 4);
  }, [contracts]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 px-5 pt-5">
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col gap-1.5">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">
          Hodnota smluv
        </div>
        <div className="text-xl font-bold text-slate-100 tabular-nums">
          {formatMoney(stats.contractTotal)}
        </div>
        <div className="text-[11.5px] text-slate-400 flex gap-2 flex-wrap">
          <span>Originál: {formatMoney(stats.basePriceTotal)}</span>
          {stats.amendmentDelta !== 0 && (
            <span className="rounded-full bg-red-500/15 text-red-400 px-2 py-0.5 text-[10.5px] font-semibold">
              {stats.amendmentDelta > 0 ? '+' : ''}dodatky {formatMoney(stats.amendmentDelta)}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col gap-1.5">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">
          Peníze v pohybu
        </div>
        <div className="flex gap-4 items-end">
          <div>
            <div className="text-[17px] font-bold text-blue-400 tabular-nums">
              {formatMoney(stats.invoiced)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Nafakturováno</div>
          </div>
          <div>
            <div className="text-[17px] font-bold text-green-400 tabular-nums">
              {formatMoney(stats.paid)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Zaplaceno</div>
          </div>
          <div>
            <div className="text-[17px] font-bold text-red-400 tabular-nums">
              {formatMoney(stats.overdue)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Po splatnosti</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col gap-1.5">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">
          Drží se v pozastávce
        </div>
        <div className="flex gap-4 items-end">
          <div className="pl-2 border-l-[3px] border-blue-500">
            <div className="text-[17px] font-bold text-blue-400 tabular-nums">
              {formatMoney(stats.shortTotal)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Krátkodobá</div>
            <div className="text-[10px] text-slate-600">do převzetí</div>
          </div>
          <div className="pl-2 border-l-[3px] border-purple-500">
            <div className="text-[17px] font-bold text-purple-400 tabular-nums">
              {formatMoney(stats.longTotal)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Dlouhodobá</div>
            <div className="text-[10px] text-slate-600">do konce záruky</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col gap-1.5">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">
          Alerty · 14 dní
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {alerts.length === 0 ? (
            <span className="text-[11.5px] text-slate-500">Žádné otevřené alerty.</span>
          ) : (
            alerts.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11.5px] text-slate-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    a.color === 'red'
                      ? 'bg-red-500'
                      : a.color === 'amber'
                        ? 'bg-amber-500'
                        : a.color === 'blue'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                  }`}
                />
                <span className="truncate">{a.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
