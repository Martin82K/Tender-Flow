import React, { useEffect, useState } from "react";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import { getContractOverview, type ContractOverviewRow } from "./api/contractOverviewApi";
import { useAuth } from "@/context/AuthContext";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export const ContractOverview: React.FC = () => {
  const { user } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<ContractOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getContractOverview(user?.organizationId ?? null, includeArchived)
      .then((data) => { if (active) setRows(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Přehled se nepodařilo načíst."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [includeArchived, user?.organizationId]);

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <Header title="Smluvní přehled" subtitle="Read-only přehled napříč stavbami organizace" helpSlot={<HelpButton />} notificationSlot={<NotificationBell />} />
      <main className="flex-1 overflow-auto p-6 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Zobrazeny jsou pouze základní parametry smluv a souhrnné čerpání. Nabídky, rozhodnutí, dokumenty a jednotlivé faktury nejsou součástí přehledu.</p>
            <label className="ml-6 inline-flex shrink-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
              Zahrnout archiv
            </label>
          </div>
          {loading && <div className="py-16 text-center text-slate-500">Načítám smluvní přehled…</div>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && !error && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr><th className="p-3">Stavba</th><th className="p-3">Partner / smlouva</th><th className="p-3">Stav</th><th className="p-3 text-right">Limit</th><th className="p-3 text-right">Čerpání</th><th className="p-3 text-right">Zbývá</th><th className="p-3">Parametry</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.contractId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="p-3"><div className="font-semibold">{row.projectName}</div><div className="text-xs text-slate-400">{row.projectStatus}</div></td>
                      <td className="p-3"><div className="font-semibold">{row.contractPartner}</div><div className="text-xs text-slate-500">{row.contractTitle}{row.contractNumber ? ` · ${row.contractNumber}` : ""}</div></td>
                      <td className="p-3">{row.contractStatus}</td><td className="p-3 text-right tabular-nums">{money(row.currentTotal, row.currency)}</td><td className="p-3 text-right tabular-nums">{money(row.approvedDrawdown, row.currency)}</td><td className="p-3 text-right tabular-nums">{money(row.remainingAmount, row.currency)}</td>
                      <td className="p-3 text-xs text-slate-500">{row.retentionPercent == null ? "" : `Zádržné ${row.retentionPercent} %`}{row.retentionPercent != null && row.warrantyMonths != null ? " · " : ""}{row.warrantyMonths == null ? "" : `Záruka ${row.warrantyMonths} měs.`}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-400">Žádné smlouvy k zobrazení.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
