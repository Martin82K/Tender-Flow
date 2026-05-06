import React, { useMemo } from 'react';
import type { ContractWithDetails, ProjectDetails } from '@/types';
import { formatDecimal } from '@/utils/formatters';
import { addMonthsIso, daysUntil, formatDate, formatMoney } from '../utils/format';
import { computeContractsDashboardStats } from './contractsDashboardModel';

interface Props {
  contracts: ContractWithDetails[];
  projectDetails?: ProjectDetails;
}

export const ContractsDashboard: React.FC<Props> = ({ contracts, projectDetails }) => {
  const stats = useMemo(
    () => computeContractsDashboardStats(contracts, projectDetails),
    [contracts, projectDetails],
  );

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
  const investorInvTotal =
    stats.investorPaid + stats.investorApproved + stats.investorIssued + stats.investorOverdue || 1;
  const investorInvPct = (v: number) => Math.round((v / investorInvTotal) * 100);
  const progressPct = (value: number) => `${Math.min(100, Math.max(0, Math.round(value * 100)))}%`;
  const profitColor = (value: number) =>
    value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const renderCashflowBar = (
    values: { paid: number; approved: number; issued: number; overdue: number },
    pct: (value: number) => number,
  ) => (
    <div className="mt-2 flex h-8 rounded-md overflow-hidden">
      <div
        className="bg-green-500 grid place-items-center text-[11px] font-bold text-slate-950"
        style={{ flex: Math.max(values.paid, 0.01) }}
        title="Zaplaceno"
      >
        {pct(values.paid) >= 8 ? `${pct(values.paid)}%` : ''}
      </div>
      <div
        className="bg-blue-500 grid place-items-center text-[11px] font-bold text-slate-950"
        style={{ flex: Math.max(values.approved, 0.01) }}
        title="Schváleno"
      >
        {pct(values.approved) >= 8 ? `${pct(values.approved)}%` : ''}
      </div>
      <div
        className="bg-amber-500 grid place-items-center text-[11px] font-bold text-slate-950"
        style={{ flex: Math.max(values.issued, 0.01) }}
        title="Vystaveno"
      >
        {pct(values.issued) >= 8 ? `${pct(values.issued)}%` : ''}
      </div>
      <div
        className="bg-red-500 grid place-items-center text-[11px] font-bold text-slate-950"
        style={{ flex: Math.max(values.overdue, 0.01) }}
        title="Po splatnosti"
      >
        {pct(values.overdue) >= 8 ? `${pct(values.overdue)}%` : ''}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-3 p-5">
      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
          Počet smluv
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.count}</div>
        <div className="text-xs text-slate-600 dark:text-slate-400 flex gap-2 flex-wrap mt-1">
          <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 px-2 py-0.5 text-[10.5px] font-semibold">
            {stats.active} aktivních
          </span>
          <span className="rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 text-[10.5px] font-semibold">
            {stats.closed} uzavřených
          </span>
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
          Průměrná hodnota
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
          {formatMoney(stats.avg)}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          medián <strong className="text-slate-700 dark:text-slate-300">{formatMoney(stats.med)}</strong>
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
          Dodatky · dopad
        </div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1 tabular-nums">
          {stats.amendmentDelta >= 0 ? '+' : ''}
          {formatMoney(stats.amendmentDelta)}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{stats.amendmentCount} dodatků</div>
      </div>

      <div className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
          Průměrné hodnocení
        </div>
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
          {stats.avgRating !== null
            ? `${formatDecimal(stats.avgRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★`
            : '—'}
        </div>
      </div>

      <div className="col-span-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mb-3">
          Investor vs. náklady
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-emerald-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Rozpočet investora
            </div>
            <div className="text-[17px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatMoney(stats.investorBudget)}
            </div>
            <div className="text-[10.5px] text-slate-600 dark:text-slate-500">
              proti zasmluvněným nákladům {formatMoney(stats.contractedCosts)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-blue-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Fakturace investorovi
            </div>
            <div className="text-[17px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatMoney(stats.investorInvoiced)}
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <span className="block h-full bg-blue-500" style={{ width: progressPct(stats.investorInvoiceProgress) }} />
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-amber-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Fakturace dodavatelů
            </div>
            <div className="text-[17px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatMoney(stats.invoiced)}
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <span className="block h-full bg-amber-500" style={{ width: progressPct(stats.supplierInvoiceProgress) }} />
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-primary px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Výnos z fakturace
            </div>
            <div className={`text-[17px] font-bold tabular-nums ${profitColor(stats.invoicingProfit)}`}>
              {formatMoney(stats.invoicingProfit)}
            </div>
            <div className="text-[10.5px] text-slate-600 dark:text-slate-500">
              očekávaný výnos {formatMoney(stats.expectedProfit)}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-600 dark:text-slate-500">
          <span>Uhrazeno investorem: <strong className="text-slate-800 dark:text-slate-200">{formatMoney(stats.investorPaid)}</strong></span>
          <span>Investor po splatnosti: <strong className="text-red-600 dark:text-red-400">{formatMoney(stats.investorOverdue)}</strong></span>
        </div>
      </div>

      <div className="col-span-12 md:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mb-3">
          Cashflow · přehled
        </h3>
        <div className="flex gap-5 flex-wrap text-xs">
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
            Vyfakturováno · <strong>{formatMoney(stats.invoiced)}</strong>
          </span>
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-sm" />
            Zaplaceno · <strong>{formatMoney(stats.paid)}</strong>
          </span>
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
            Po splatnosti · <strong>{formatMoney(stats.overdue)}</strong>
          </span>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                Investor
              </span>
              <span className="text-slate-600 dark:text-slate-500">
                celkem {formatMoney(stats.investorInvoiced)}
              </span>
            </div>
            {renderCashflowBar(
              {
                paid: stats.investorPaid,
                approved: stats.investorApproved,
                issued: stats.investorIssued,
                overdue: stats.investorOverdue,
              },
              investorInvPct,
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                Dodavatelé
              </span>
              <span className="text-slate-600 dark:text-slate-500">
                celkem {formatMoney(stats.invoiced)}
              </span>
            </div>
            {renderCashflowBar(
              {
                paid: stats.paid,
                approved: stats.approved,
                issued: stats.issued,
                overdue: stats.overdue,
              },
              invPct,
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mb-3">
          Pozastávky
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-blue-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Krátkodobá
            </div>
            <div className="text-[17px] font-bold text-blue-400 tabular-nums">
              {formatMoney(stats.shortTotal)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border-l-[3px] !border-l-purple-500 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold">
              Dlouhodobá
            </div>
            <div className="text-[17px] font-bold text-purple-400 tabular-nums">
              {formatMoney(stats.longTotal)}
            </div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mt-4 mb-2">
          Top smlouvy
        </div>
        <div>
          {stats.topRetention.map((r) => (
            <div
              key={r.contract.id}
              className="grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 border-b border-dashed border-slate-200 dark:border-slate-800 text-[11.5px] items-center last:border-b-0"
            >
              <div className="truncate">
                <strong>{r.contract.title}</strong>
                <span className="text-slate-600 dark:text-slate-500"> · {r.contract.vendorName}</span>
              </div>
              <div className="text-blue-600 dark:text-blue-400 tabular-nums">K: {formatMoney(r.shortAmount)}</div>
              <div className="text-purple-600 dark:text-purple-400 tabular-nums">D: {formatMoney(r.longAmount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-12 md:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mb-3">
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
              <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="col-span-12 md:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h3 className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-bold mb-3">
          Blížící se termíny · 30 dní
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {upcoming.length === 0 ? (
            <div className="text-xs text-slate-600 dark:text-slate-500 col-span-full">
              Žádné termíny v nejbližších 30 dnech.
            </div>
          ) : (
            upcoming.map((e, idx) => (
              <div
                key={idx}
                className={`rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 border-l-[3px] ${e.color} px-3 py-2`}
              >
                <div className="flex justify-between font-semibold text-xs">
                  <span>{e.label}</span>
                  <span className="text-slate-600 dark:text-slate-500 tabular-nums">{formatDate(e.date)}</span>
                </div>
                <div className="text-[10.5px] text-slate-600 dark:text-slate-500 mt-0.5">{e.detail}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
