import React, { useEffect, useMemo, useState } from "react";
import type {
  ContractStatus,
  ContractSummaryDto,
  ContractSummaryFilters,
  ProjectDetails,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { logIncident } from "@/services/incidentLogger";
import { organizationService } from "@/services/organizationService";
import {
  exportContractSummariesToPdf,
  exportContractSummariesToXlsx,
} from "@/services/exportService";
import {
  filterAndSortContractSummaryList,
  formatContractSummaryMoney,
  formatContractSummaryPaymentTerms,
  formatContractSummaryRetention,
  formatContractSummarySiteSetup,
  formatContractSummaryWarranty,
  getContractSummaryStatusLabel,
} from "@/shared/contracts/contractSummary";

interface ContractsSummaryViewProps {
  contracts: ContractSummaryDto[];
  projectDetails?: ProjectDetails;
  emptyTitle?: string;
  emptyDescription?: string;
  onContractSelect?: (contractId: string) => void;
  rowActionLabel?: string;
}

const statusBadgeClasses: Record<ContractStatus, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const filterButtonClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";
const primaryButtonClass =
  "rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";
const cardClass =
  "rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800";

export const ContractsSummaryView: React.FC<ContractsSummaryViewProps> = ({
  contracts,
  projectDetails,
  emptyTitle = "Žádné smlouvy k zobrazení",
  emptyDescription = "Zkuste upravit filtry nebo nejdřív založte smlouvu.",
  onContractSelect,
  rowActionLabel = "Otevřít",
}) => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ContractSummaryFilters>({
    query: "",
    status: "all",
  });
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setLogoUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextLogoUrl = await organizationService.getOrganizationLogoUrl(orgId, {
          expiresInSeconds: 1800,
        });
        if (!cancelled) {
          setLogoUrl(nextLogoUrl);
        }
      } catch (error) {
        void logIncident({
          severity: "warn",
          source: "renderer",
          category: "ui",
          code: "CONTRACT_SUMMARY_BRANDING_LOAD_FAILED",
          message: `Nepodařilo se načíst branding loga pro export přehledu smluv: ${
            error instanceof Error ? error.message : String(error)
          }`,
          stack: error instanceof Error ? error.stack : null,
          context: {
            feature: "contracts_summary",
            action: "load_branding_logo",
            operation: "contracts_summary.branding",
            organization_id: orgId,
            project_id: projectDetails?.id ?? null,
            reason: error instanceof Error ? error.message : String(error),
            action_status: "fallback",
          },
        });
        if (!cancelled) {
          setLogoUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.organizationId]);

  const filteredContracts = useMemo(
    () => filterAndSortContractSummaryList(contracts, filters, "vendor_asc"),
    [contracts, filters],
  );

  const exportMeta = {
    organizationName: user?.organizationName || "Organizace",
    organizationLogoUrl: logoUrl || undefined,
    projectName: projectDetails?.title || "Projekt",
  };

  const handleExport = async (format: "xlsx" | "pdf") => {
    try {
      setError(null);
      setExporting(format);
      if (format === "xlsx") {
        await exportContractSummariesToXlsx(filteredContracts, exportMeta);
        return;
      }
      await exportContractSummariesToPdf(filteredContracts, exportMeta);
    } catch (exportError) {
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "ui",
        code:
          format === "xlsx"
            ? "CONTRACT_SUMMARY_EXPORT_XLSX_FAILED"
            : "CONTRACT_SUMMARY_EXPORT_PDF_FAILED",
        message: `Export přehledu smluv do ${format.toUpperCase()} selhal: ${
          exportError instanceof Error ? exportError.message : String(exportError)
        }`,
        stack: exportError instanceof Error ? exportError.stack : null,
        context: {
          feature: "contracts_summary",
          action: "export_contract_summary",
          operation: `contracts_summary.export_${format}`,
          organization_id: user?.organizationId ?? null,
          project_id: projectDetails?.id ?? null,
          entity_type: "contract_summary",
          action_status: "failed",
          reason:
            exportError instanceof Error ? exportError.message : String(exportError),
        },
      });
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Nepodařilo se vytvořit export přehledu smluv.",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardClass} p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hledat smlouvu
              </span>
              <input
                value={filters.query || ""}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, query: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                placeholder="Číslo smlouvy, dodavatel nebo název"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stav
              </span>
              <select
                value={filters.status || "all"}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value as ContractStatus | "all",
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">Všechny stavy</option>
                <option value="active">Aktivní</option>
                <option value="draft">Rozpracováno</option>
                <option value="closed">Uzavřeno</option>
                <option value="cancelled">Zrušeno</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport("xlsx")}
              disabled={filteredContracts.length === 0 || exporting !== null}
              className={filterButtonClass}
            >
              {exporting === "xlsx" ? "Exportuji Excel..." : "Export do Excelu"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport("pdf")}
              disabled={filteredContracts.length === 0 || exporting !== null}
              className={filterButtonClass}
            >
              {exporting === "pdf" ? "Exportuji PDF..." : "Export do PDF"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {filteredContracts.length === 0 ? (
        <div className={`${cardClass} py-12 text-center`}>
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
            description
          </span>
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {emptyTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <>
          <div className={`${cardClass} hidden overflow-hidden xl:block`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Číslo smlouvy
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dodavatel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cena
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pozastávka
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Zařízení staveniště
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Záruční doba
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Splatnost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Stav
                    </th>
                    {onContractSelect ? <th className="px-4 py-3" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredContracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                        <div className="font-semibold">
                          {contract.contractNumber || "-"}
                        </div>
                        <div className="text-xs text-slate-500">{contract.title}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {contract.vendorName}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                        {formatContractSummaryMoney(
                          contract.currentTotal,
                          contract.currency,
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatContractSummaryRetention(contract)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatContractSummarySiteSetup(contract.siteSetupPercent)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatContractSummaryWarranty(contract.warrantyMonths)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatContractSummaryPaymentTerms(contract.paymentTerms)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses[contract.status]}`}
                        >
                          {getContractSummaryStatusLabel(contract.status)}
                        </span>
                      </td>
                      {onContractSelect ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onContractSelect(contract.id)}
                            className={primaryButtonClass}
                          >
                            {rowActionLabel}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 xl:hidden">
            {filteredContracts.map((contract) => (
              <article key={contract.id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {contract.contractNumber || "Bez čísla smlouvy"}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {contract.vendorName}
                    </h3>
                    <p className="text-sm text-slate-500">{contract.title}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses[contract.status]}`}
                  >
                    {getContractSummaryStatusLabel(contract.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Cena</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatContractSummaryMoney(contract.currentTotal, contract.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Pozastávka</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {formatContractSummaryRetention(contract)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Zařízení staveniště
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {formatContractSummarySiteSetup(contract.siteSetupPercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Záruční doba</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {formatContractSummaryWarranty(contract.warrantyMonths)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Splatnost</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {formatContractSummaryPaymentTerms(contract.paymentTerms)}
                    </p>
                  </div>
                </div>

                {onContractSelect ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => onContractSelect(contract.id)}
                      className={`${primaryButtonClass} w-full`}
                    >
                      {rowActionLabel}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
