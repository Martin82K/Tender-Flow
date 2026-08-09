import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import {
  formatContractOverviewMoney,
  getContractOverview,
  openContractOverviewDocument,
  type ContractOverviewAmendment,
  type ContractOverviewRow,
} from "./api/contractOverviewApi";
import { exportContractOverviewToExcel } from "./api/contractOverviewExport";
import {
  CONTRACT_OVERVIEW_PARAMETER_KEYS,
  CONTRACT_OVERVIEW_PARAMETER_LABELS,
  filterContractOverviewRows,
  formatContractOverviewDate,
  formatContractOverviewPercent,
  getContractOverviewStatusLabel,
  toggleContractOverviewProject,
  type ContractOverviewParameterKey,
} from "./model/contractOverviewModel";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { ContractOverviewProjectCheckbox, type ContractOverviewCheckboxState } from "./ui/ContractOverviewProjectCheckbox";
import { ContractOverviewColumnsMenu } from "./ui/ContractOverviewColumnsMenu";

interface DocumentButtonProps {
  document: Pick<ContractOverviewRow | ContractOverviewAmendment, "documentUrl" | "documentStoragePath" | "documentFileName">;
  kind: "contract" | "amendment";
  onError: (message: string) => void;
}

const DocumentButton: React.FC<DocumentButtonProps> = ({ document, kind, onError }) => {
  const hasDocument = Boolean(document.documentUrl || document.documentStoragePath);
  if (!hasDocument) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  return (
    <button
      type="button"
      title={document.documentFileName || "Otevřít připojený dokument"}
      onClick={() => {
        void openContractOverviewDocument(document, kind).catch((reason: unknown) => {
          onError(reason instanceof Error ? reason.message : "Dokument se nepodařilo otevřít.");
        });
      }}
      className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[15px]">description</span>
      Otevřít
    </button>
  );
};

const parameterValue = (row: ContractOverviewRow, key: ContractOverviewParameterKey): string => {
  switch (key) {
    case "warranty": return row.warrantyMonths == null ? "" : `${row.warrantyMonths} měs.`;
    case "warrantyEnd": return formatContractOverviewDate(row.warrantyEnd);
    case "retentionShort": return formatContractOverviewPercent(row.retentionShortPercent);
    case "retentionShortRelease": return formatContractOverviewDate(row.retentionShortReleaseOn);
    case "retentionLong": return formatContractOverviewPercent(row.retentionLongPercent);
    case "retentionLongRelease": return formatContractOverviewDate(row.retentionLongReleaseOn);
    case "warrantyRetention": return formatContractOverviewPercent(row.warrantyRetentionPercent);
    case "warrantyRetentionRelease": return formatContractOverviewDate(row.warrantyRetentionReleaseOn);
    case "maturity": return row.maturityDays == null ? "" : `${row.maturityDays} dní`;
    case "paymentTerms": return row.paymentTerms || "";
  }
};

export const ContractOverview: React.FC = () => {
  const { user } = useAuth();
  const { showAlert } = useUI();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<ContractOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string> | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [visibleParameters, setVisibleParameters] = useState<Set<ContractOverviewParameterKey>>(
    () => new Set(CONTRACT_OVERVIEW_PARAMETER_KEYS),
  );
  const [exporting, setExporting] = useState(false);

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

  const projects = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const row of rows) {
      const current = counts.get(row.projectId);
      if (current) current.count += 1;
      else counts.set(row.projectId, { id: row.projectId, name: row.projectName, count: 1 });
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [rows]);

  const filteredProjects = useMemo(() => {
    const normalized = projectQuery.trim().toLocaleLowerCase("cs-CZ");
    return normalized
      ? projects.filter((project) => project.name.toLocaleLowerCase("cs-CZ").includes(normalized))
      : projects;
  }, [projectQuery, projects]);

  const statuses = useMemo(
    () => [...new Set(rows.map((row) => row.contractStatus))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => filterContractOverviewRows(rows, {
    query,
    projectIds: selectedProjectIds || new Set<string>(),
    statuses: selectedStatuses,
  }), [query, rows, selectedProjectIds, selectedStatuses]);

  const visibleParameterKeys = useMemo(
    () => CONTRACT_OVERVIEW_PARAMETER_KEYS.filter((key) => visibleParameters.has(key)),
    [visibleParameters],
  );

  const allProjectsChecked: ContractOverviewCheckboxState = selectedProjectIds === null
    || selectedProjectIds.size === projects.length
    ? true
    : selectedProjectIds.size > 0 ? "mixed" : false;

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((current) => toggleContractOverviewProject(current, projectId));
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((current) => {
      if (current.size === 0) return new Set([status]);
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next.size === statuses.length ? new Set() : next;
    });
  };

  const toggleParameter = (key: ContractOverviewParameterKey) => {
    setVisibleParameters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDocumentError = (message: string) => {
    showAlert({ title: "Dokument nelze otevřít", message, variant: "danger" });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportContractOverviewToExcel(filteredRows, visibleParameterKeys);
    } catch (reason) {
      showAlert({
        title: "Export se nezdařil",
        message: reason instanceof Error ? reason.message : "Excel se nepodařilo vytvořit.",
        variant: "danger",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="tf-contract-overview flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      <Header title="Smluvní přehled" subtitle="Read-only přehled smluv podle oprávnění profesní role" helpSlot={<HelpButton />} notificationSlot={<NotificationBell />} />
      <main className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:p-6">
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-slate-900 dark:text-white">Stavby</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800">{rows.length}</span>
            </div>
            <div className="relative mt-3">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-2.5 top-2 text-[17px] text-slate-400">search</span>
              <input
                aria-label="Hledat stavbu"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder="Hledat stavbu…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <ContractOverviewProjectCheckbox
              checked={allProjectsChecked}
              label="Všechny stavby"
              onChange={() => setSelectedProjectIds(null)}
              className={`text-sm font-semibold ${selectedProjectIds === null ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              <span className="min-w-0 flex-1">Všechny stavby</span><span>{rows.length}</span>
            </ContractOverviewProjectCheckbox>
            <div className="mt-1 space-y-0.5">
              {filteredProjects.map((project) => (
                <ContractOverviewProjectCheckbox
                  key={project.id}
                  checked={selectedProjectIds?.has(project.id) ?? false}
                  label={project.name}
                  onChange={() => toggleProject(project.id)}
                  className={`text-xs ${selectedProjectIds?.has(project.id) ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <span className="min-w-0 flex-1 leading-snug">{project.name}</span>
                  <span className="font-semibold text-slate-400">{project.count}</span>
                </ContractOverviewProjectCheckbox>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                <input
                  aria-label="Hledat ve smluvním přehledu"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Hledat partnera, smlouvu nebo číslo…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-wrap gap-1" aria-label="Filtr stavu smluv">
                <button type="button" onClick={() => setSelectedStatuses(new Set())} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selectedStatuses.size === 0 ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>Vše</button>
                {statuses.map((status) => (
                  <button key={status} type="button" onClick={() => toggleStatus(status)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selectedStatuses.has(status) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>
                    {getContractOverviewStatusLabel(status)}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} className="accent-primary" />
                Zahrnout archiv
              </label>
              <ContractOverviewColumnsMenu visible={visibleParameters} onToggle={toggleParameter} />
              <button type="button" disabled={exporting || filteredRows.length === 0} onClick={() => void handleExport()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>
                {exporting ? "Exportuji…" : "Export do Excelu"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Zobrazeno {filteredRows.length} smluv. Nabídky, rozhodnutí, technické dokumenty a jednotlivé faktury nejsou součástí přehledu.</p>
          </div>

          {loading && <div className="flex flex-1 items-center justify-center text-slate-500">Načítám smluvní přehled…</div>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && !error && (
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: `${1360 + visibleParameterKeys.length * 170}px` }}>
                <thead className="sticky top-0 z-30 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 top-0 z-50 w-[220px] min-w-[220px] border-b border-r border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">Stavba</th>
                    <th rowSpan={2} className="sticky left-[220px] top-0 z-50 w-[200px] min-w-[200px] border-b border-r border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">Partner</th>
                    <th rowSpan={2} className="sticky left-[420px] top-0 z-50 w-[220px] min-w-[220px] border-b border-r border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">Smlouva</th>
                    <th rowSpan={2} className="min-w-[125px] border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">Dokument smlouvy</th>
                    <th rowSpan={2} className="min-w-[105px] border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">Stav</th>
                    <th rowSpan={2} title="Aktuální hodnota smlouvy včetně dodatků" className="min-w-[150px] border-b border-slate-200 bg-slate-50 p-3 text-right dark:border-slate-700 dark:bg-slate-800">Limit</th>
                    <th rowSpan={2} className="min-w-[140px] border-b border-slate-200 bg-slate-50 p-3 text-right dark:border-slate-700 dark:bg-slate-800">Čerpání</th>
                    <th rowSpan={2} className="min-w-[140px] border-b border-slate-200 bg-slate-50 p-3 text-right dark:border-slate-700 dark:bg-slate-800">Zbývá</th>
                    {visibleParameterKeys.length > 0 && <th colSpan={visibleParameterKeys.length} className="border-b border-l border-slate-200 bg-primary/5 p-3 text-center text-primary dark:border-slate-700">Smluvní parametry</th>}
                  </tr>
                  {visibleParameterKeys.length > 0 && (
                    <tr>{visibleParameterKeys.map((key) => <th key={key} className="min-w-[170px] border-b border-l border-slate-200 bg-slate-50 p-3 normal-case tracking-normal dark:border-slate-700 dark:bg-slate-800">{CONTRACT_OVERVIEW_PARAMETER_LABELS[key]}</th>)}</tr>
                  )}
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <React.Fragment key={row.contractId}>
                      <tr className="tf-contract-overview-row group border-b border-slate-100">
                        <td className="sticky left-0 z-20 w-[220px] border-b border-r border-slate-100 bg-white p-3 align-top font-semibold text-slate-800 group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:group-hover:bg-slate-800">{row.projectName}</td>
                        <td className="sticky left-[220px] z-20 w-[200px] border-b border-r border-slate-100 bg-white p-3 align-top font-semibold text-slate-700 group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:group-hover:bg-slate-800">{row.contractPartner}</td>
                        <td className="sticky left-[420px] z-20 w-[220px] border-b border-r border-slate-100 bg-white p-3 align-top group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800"><div className="font-semibold text-slate-800 dark:text-slate-100">{row.contractTitle}</div><div className="mt-1 text-xs text-slate-500">{row.contractNumber || "—"}</div></td>
                        <td className="border-b border-slate-100 p-3 align-top dark:border-slate-800"><DocumentButton document={row} kind="contract" onError={handleDocumentError} /></td>
                        <td className="border-b border-slate-100 p-3 align-top dark:border-slate-800"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{getContractOverviewStatusLabel(row.contractStatus)}</span></td>
                        <td className="border-b border-slate-100 p-3 text-right align-top font-semibold tabular-nums dark:border-slate-800">{formatContractOverviewMoney(row.currentTotal, row.currency)}</td>
                        <td className="border-b border-slate-100 p-3 text-right align-top tabular-nums dark:border-slate-800">{formatContractOverviewMoney(row.approvedDrawdown, row.currency)}</td>
                        <td className="border-b border-slate-100 p-3 text-right align-top tabular-nums dark:border-slate-800">{formatContractOverviewMoney(row.remainingAmount, row.currency)}</td>
                        {visibleParameterKeys.map((key) => <td key={key} className="border-b border-l border-slate-100 p-3 align-top text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">{parameterValue(row, key) || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>)}
                      </tr>
                      {row.amendments.map((amendment) => (
                        <tr key={amendment.id} className="tf-contract-overview-row group bg-slate-50/70 dark:bg-slate-950/40">
                          <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950" />
                          <td className="sticky left-[220px] z-10 border-b border-r border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950" />
                          <td className="sticky left-[420px] z-10 border-b border-r border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200"><span aria-hidden="true">↳</span> Dodatek č. {amendment.amendmentNo}</div><div className="mt-1 text-xs text-slate-500">Hodnota dodatku: <span className={amendment.deltaPrice < 0 ? "text-red-600 dark:text-red-400" : ""}>{formatContractOverviewMoney(amendment.deltaPrice, row.currency)}</span></div></td>
                          <td className="border-b border-slate-100 p-3 dark:border-slate-800"><DocumentButton document={amendment} kind="amendment" onError={handleDocumentError} /></td>
                          <td className="border-b border-slate-100 p-3 text-slate-300 dark:border-slate-800 dark:text-slate-600">{amendment.status ? getContractOverviewStatusLabel(amendment.status) : "—"}</td>
                          <td className="border-b border-slate-100 p-3 dark:border-slate-800" />
                          <td className="border-b border-slate-100 p-3 dark:border-slate-800" />
                          <td className="border-b border-slate-100 p-3 dark:border-slate-800" />
                          {visibleParameterKeys.map((key) => <td key={key} className="border-b border-l border-slate-100 p-3 text-slate-300 dark:border-slate-800 dark:text-slate-700">—</td>)}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {filteredRows.length === 0 && <tr><td colSpan={8 + visibleParameterKeys.length} className="p-12 text-center text-slate-400">Žádné smlouvy odpovídající filtrům.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
