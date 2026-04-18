import React, { useMemo } from 'react';
import type { ContractWithDetails } from '@/types';
import { addMonthsIso, daysUntil, formatDate, formatMoney } from '../utils/format';
import { sumProjectRetention, computeRetention } from '../utils/retention';

interface Props {
  contracts: ContractWithDetails[];
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const ContractsDashboard: React.FC<Props> = ({ contracts }) => {
  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active').length;
    const closed = contracts.filter((c) => c.status === 'closed').length;
    const values = contracts.filter((c) => c.currentTotal > 0).map((c) => c.currentTotal);
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const med = median(values);
    const amendmentDelta = contracts.reduce(
      (s, c) => s + ((c.currentTotal || 0) - (c.basePrice || 0)),
      0,
    );
    const amendmentCount = contracts.reduce((s, c) => s + (c.amendments?.length || 0), 0);
    const rated = contracts.filter((c) => c.vendorRating != null);
    const avgRating = rated.length
      ? rated.reduce((s, c) => s + (c.vendorRating || 0), 0) / rated.length
      : null;

    const allInvoices = contracts.flatMap((c) => c.invoices || []);
    const sumBy = (status: string) =>
      allInvoices.filter((i) => i.status === status).reduce((s, i) => s + i.amount, 0);

    const invoiced = contracts.reduce((s, c) => s + (c.invoicedSum || 0), 0);
    const paid = sumBy('paid');
    const approved = sumBy('approved');
    const issued = sumBy('issued');
    const overdue = contracts.reduce((s, c) => s + (c.overdueSum || 0), 0);

    const { shortTotal, longTotal } = sumProjectRetention(contracts);

    const topVendors = [...contracts]
      .filter((c) => c.currentTotal > 0)
      .sort((a, b) => b.currentTotal - a.currentTotal)
      .slice(0, 6);
    const topVendorsTotal = topVendors.reduce((s, c) => s + c.currentTotal, 0);

    const topRetention = [...contracts]
      .map((c) => {
        const breakdown = computeRetention(c);
        return {
          contract: c,
          shortAmount: breakdown.shortAmount,
          longAmount: breakdown.longAmount,
          total: breakdown.totalAmount,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      count: contracts.length,
      active,
      closed,
      avg,
      med,
      amendmentDelta,
      amendmentCount,
      avgRating,
      invoiced,
      paid,
      approved,
      issued,
      overdue,
      shortTotal,
      longTotal,
      topVendors,
      topVendorsTotal,
      topRetention,
    };
  }, [contracts]);

  const upcoming = useMemo(() => {
    const events: { date: string; label: string; detail: string; color: string }[] = [];
    for (const c of contracts) {
      for (const inv of c.invoices || []) {
        const d = daysUntil(inv.dueDate);
        if (d !== null && d <= 30 && inv.status !== 'paid') {
          events.push({
            date: inv.dueDate,
            label: inv.invoiceNumber,
            detail: `${inv.status === 'overdue' || d < 0 ? 'Po splatnosti' : 'Splatnost faktury'} · ${c.title}`,
            color: inv.status === 'overdue' || d < 0 ? 'border-l-red-500' : 'border-l-amber-500',
          });
        }
      }
      const warrantyEnd = addMonthsIso(c.signedAt, c.warrantyMonths ?? null);
      const d = daysUntil(warrantyEnd);
      if (d !== null && d <= 60 && d >= 0) {
        events.push({
          date: warrantyEnd!,
          label: c.title,
          detail: `Konec záruky · ${c.vendorName}`,
          color: 'border-l-blue-500',
        });
      }
    }
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events.slice(0, 9);
  }, [contracts]);

  const invTotal = stats.paid + stats.approved + stats.issued + stats.overdue || 1;
  const invPct = (v: number) => Math.round((v / invTotal) * 100);

  return (
    <div className="grid grid-cols-12 gap-3 p-5">
      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          Počet smluv
        </div>
        <div className="text-2xl font-bold text-slate-100 mt-1">{stats.count}</div>
        <div className="text-xs text-slate-400 flex gap-2 flex-wrap mt-1">
          <span className="rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 text-[10.5px] font-semibold">
            {stats.active} aktivních
          </span>
          <span className="rounded-full bg-slate-800 text-slate-400 px-2 py-0.5 text-[10.5px] font-semibold">
            {stats.closed} uzavřených
          </span>
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          Průměrná hodnota
        </div>
        <div className="text-2xl font-bold text-slate-100 mt-1 tabular-nums">
          {formatMoney(stats.avg)}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          medián <strong className="text-slate-300">{formatMoney(stats.med)}</strong>
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          Dodatky · dopad
        </div>
        <div className="text-2xl font-bold text-red-400 mt-1 tabular-nums">
          {stats.amendmentDelta >= 0 ? '+' : ''}
          {formatMoney(stats.amendmentDelta)}
        </div>
        <div className="text-xs text-slate-400 mt-1">{stats.amendmentCount} dodatků</div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          Průměrné hodnocení
        </div>
        <div className="text-2xl font-bold text-amber-400 mt-1">
          {stats.avgRating !== null ? `${stats.avgRating.toFixed(1)} ★` : '—'}
        </div>
      </div>

      <div className="col-span-12 md:col-span-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Cashflow · přehled
        </h3>
        <div className="flex gap-5 flex-wrap text-xs">
          <span className="text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
            Nafakturováno · <strong>{formatMoney(stats.invoiced)}</strong>
          </span>
          <span className="text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-sm" />
            Zaplaceno · <strong>{formatMoney(stats.paid)}</strong>
          </span>
          <span className="text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
            Po splatnosti · <strong>{formatMoney(stats.overdue)}</strong>
          </span>
        </div>
        <div className="mt-3 flex h-8 rounded-md overflow-hidden">
          <div
            className="bg-green-500 grid place-items-center text-[11px] font-bold text-slate-950"
            style={{ flex: Math.max(stats.paid, 0.01) }}
            title="Zaplaceno"
          >
            {invPct(stats.paid) >= 8 ? `${invPct(stats.paid)}%` : ''}
          </div>
          <div
            className="bg-blue-500 grid place-items-center text-[11px] font-bold text-slate-950"
            style={{ flex: Math.max(stats.approved, 0.01) }}
            title="Schváleno"
          >
            {invPct(stats.approved) >= 8 ? `${invPct(stats.approved)}%` : ''}
          </div>
          <div
            className="bg-amber-500 grid place-items-center text-[11px] font-bold text-slate-950"
            style={{ flex: Math.max(stats.issued, 0.01) }}
            title="Vystaveno"
          >
            {invPct(stats.issued) >= 8 ? `${invPct(stats.issued)}%` : ''}
          </div>
          <div
            className="bg-red-500 grid place-items-center text-[11px] font-bold text-slate-950"
            style={{ flex: Math.max(stats.overdue, 0.01) }}
            title="Po splatnosti"
          >
            {invPct(stats.overdue) >= 8 ? `${invPct(stats.overdue)}%` : ''}
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Pozastávky
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-950/60 border-l-[3px] border-l-blue-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Krátkodobá
            </div>
            <div className="text-[17px] font-bold text-blue-400 tabular-nums">
              {formatMoney(stats.shortTotal)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 border-l-[3px] border-l-purple-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Dlouhodobá
            </div>
            <div className="text-[17px] font-bold text-purple-400 tabular-nums">
              {formatMoney(stats.longTotal)}
            </div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-4 mb-2">
          Top smlouvy
        </div>
        <div>
          {stats.topRetention.map((r) => (
            <div
              key={r.contract.id}
              className="grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 border-b border-dashed border-slate-800 text-[11.5px] items-center last:border-b-0"
            >
              <div className="truncate">
                <strong>{r.contract.title}</strong>
                <span className="text-slate-500"> · {r.contract.vendorName}</span>
              </div>
              <div className="text-blue-400 tabular-nums">K: {formatMoney(r.shortAmount)}</div>
              <div className="text-purple-400 tabular-nums">D: {formatMoney(r.longAmount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-12 md:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Top dodavatelé
        </h3>
        {stats.topVendors.map((c) => {
          const p = stats.topVendorsTotal
            ? Math.round((c.currentTotal / stats.topVendorsTotal) * 100)
            : 0;
          return (
            <div key={c.id} className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate">
                  <strong>{c.vendorName}</strong>
                </span>
                <span className="tabular-nums flex-shrink-0">
                  {formatMoney(c.currentTotal, c.currency)}
                </span>
              </div>
              <div className="h-1.5 rounded bg-slate-800 overflow-hidden">
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="col-span-12 md:col-span-7 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Blížící se termíny · 30 dní
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {upcoming.length === 0 ? (
            <div className="text-xs text-slate-500 col-span-full">
              Žádné termíny v nejbližších 30 dnech.
            </div>
          ) : (
            upcoming.map((e, idx) => (
              <div
                key={idx}
                className={`rounded-lg bg-slate-950/60 border border-slate-800 border-l-[3px] ${e.color} px-3 py-2`}
              >
                <div className="flex justify-between font-semibold text-xs">
                  <span>{e.label}</span>
                  <span className="text-slate-500 tabular-nums">{formatDate(e.date)}</span>
                </div>
                <div className="text-[10.5px] text-slate-500 mt-0.5">{e.detail}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
