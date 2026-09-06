import React, { useRef } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@appica/ui-react";
import { Sparkline, SparklineChart } from "@appica/ui-react/sparkline";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import { formatMoney } from "@/shared/overview/overviewAnalytics";
import { formatDecimal } from "@/shared/formatting/decimalFormatters";
import { getOfferStatusMeta } from "@/shared/offers/offerStatus";
import { runPdfExportSafely } from "@/shared/pdf/pdfExportError";
import { projectExportApi } from "@features/projects/api/projectExportApi";
import type { Project, ProjectDetails, User } from "@/types";
import html2canvas from "html2canvas";
import {
  Building2,
  Filter,
  FileText,
  Search,
  RotateCcw,
} from "lucide-react";
import {
  ClipboardList,
  FileCheck,
  ReportMoney,
  UsersGroup,
} from "@appica/icons-react";
import { KPICard } from "@/shared/ui/overview/KPICard";
import { StatusCard } from "@/shared/ui/overview/StatusCard";
import { SupplierBarChart } from "@/shared/ui/overview/SupplierBarChart";
import { SupplierTable } from "@/shared/ui/overview/SupplierTable";
import { StatusDistributionChart } from "@/shared/ui/overview/StatusDistributionChart";
import { BudgetDeviationGauge } from "@/shared/ui/overview/BudgetDeviationGauge";
import { MonthlyVolumeTrends } from "@/shared/ui/overview/MonthlyVolumeTrends";
import { OverviewSection } from "@/features/projects/ui/OverviewSection";
import {
  formatOfferDate,
} from "@/features/projects/model/projectOverviewModel";
import { useProjectOverviewController } from "@/features/projects/model/useProjectOverviewController";
import type { ThemeSkin } from "@/shared/types/theme";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";

interface ProjectOverviewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
  user: Pick<User, "id" | "role" | "email"> | null;
  skin?: ThemeSkin;
}

const compactCurrencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  notation: "compact",
  maximumFractionDigits: 2,
});
const monthlySparklinePalette = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
] as const;

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  projects,
  projectDetails,
  user,
  skin = "classic",
}) => {
  const {
    tenantLoading,
    tenantError,
    tenantFetching,
    retryTenantData,
    tenantProjects,
    tenantProjectDetails,
    availableProjects,
    showDebugBanner,
    selectedProjectId,
    setSelectedProjectId,
    statusFilter,
    setStatusFilter,
    scope,
    setScope,
    sections,
    toggleSection,
    showAllSuppliers,
    setShowAllSuppliers,
    supplierQuery,
    setSupplierQuery,
    supplierSpecialization,
    setSupplierSpecialization,
    specializationOptions,
    supplierRows,
    filteredSuppliers,
    selectedSupplier,
    selectedSupplierOffers,
    selectedSupplierSummary,
    selectedSupplierMonthlySeries,
    topSuppliers,
    monthlyVolumeTrends,
    analytics,
    statusCounts,
    avgBudgetDeviation,
    resetSupplierFilters,
  } = useProjectOverviewController({ projects, projectDetails, user });

  const chartRef = useRef<HTMLDivElement | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const handleSupplierExport = () => {
    if (!selectedSupplier) return;
    const appUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "Tender Flow";

    const exportWithChart = async () => {
      if (!chartRef.current) {
        await projectExportApi.exportSupplierAnalysisToPDF(
          selectedSupplier.name,
          selectedSupplierSummary,
          selectedSupplierOffers,
          appUrl,
        );
        return;
      }

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");

      await projectExportApi.exportSupplierAnalysisToPDF(
        selectedSupplier.name,
        selectedSupplierSummary,
        selectedSupplierOffers,
        appUrl,
        {
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        },
      );
    };

    void runPdfExportSafely(exportWithChart, setExportError);
  };

  const formatPercent = (value: number) =>
    `${formatDecimal(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

  const formatAvgDiff = (value: number | null, label: string) => {
    if (value === null) {
      return `Bez dat pro ${label}.`;
    }
    const isPositive = value >= 0;
    return `Nabídky jsou v průměru ${isPositive ? "nad" : "pod"} ${label} o ${formatPercent(
      Math.abs(value),
    )}.`;
  };

  if (tenantLoading || tenantError) {
    return (
      <div className="tf-project-overview-view flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <Header title="Přehledy" subtitle="Analytika dodavatelů, výběrů a trendů" skin={skin} />
        <div className="m-6 rounded-xl border border-slate-200 dark:border-slate-700 p-6" role={tenantError ? "alert" : "status"}>
          {tenantError ? <>
            <p>Souhrnná data přehledu se nepodařilo načíst.</p>
            <button type="button" className="mt-3 underline" disabled={tenantFetching}
              onClick={() => { void retryTenantData({ cancelRefetch: false }); }}>
              {tenantFetching ? "Načítám…" : "Zkusit znovu"}
            </button>
          </> : "Načítám souhrnná data přehledu…"}
        </div>
      </div>
    );
  }

  return (
    <div className="tf-project-overview-view flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="no-print">
        <Header title="Přehledy" subtitle="Analytika dodavatelů, výběrů a trendů" helpSlot={<HelpButton />} notificationSlot={<NotificationBell />} skin={skin} />
      </div>

      <div className="flex-1 space-y-6 p-6">
        {exportError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {exportError}
          </div>
        )}

        {/* Debug Banner */}
        {showDebugBanner ? (
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50/90 text-amber-900 px-4 py-3 text-sm">
            <div className="font-semibold mb-1">Debug: Přehledy (tenant)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>Tenant projects: {tenantProjects.length}</div>
              <div>Tenant details: {Object.keys(tenantProjectDetails).length}</div>
              <div>Fallback projects: {projects.length}</div>
              <div>Fallback details: {Object.keys(projectDetails).length}</div>
              <div>Scope: {scope}</div>
              <div>Status filter: {statusFilter}</div>
              <div>Selected project: {selectedProjectId}</div>
              <div>Tenant loading: {tenantLoading ? "ano" : "ne"}</div>
            </div>
          </div>
        ) : null}

        {/* Filters Bar */}
        <div data-help-id="overview-scope-toggle" className="no-print flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Filter className="w-4 h-4" />
            Filtry
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 gap-0.5">
            {([
              { value: "tenant", label: "Celá společnost" },
              { value: "project", label: "Vybraný projekt" },
            ] as const).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScope(item.value)}
                className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                  scope === item.value
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <ThemedNativeSelect
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={scope === "tenant"}
              style={{ backgroundImage: "none" }}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-8 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">Všechny stavby</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </ThemedNativeSelect>
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 gap-0.5">
            {([
              { value: "all", label: "Vše" },
              { value: "tender", label: "Soutěž" },
              { value: "realization", label: "Realizace" },
              { value: "archived", label: "Archiv" },
            ] as const).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === item.value
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div data-help-id="overview-kpi" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Objem zakázek"
            value={formatMoney(analytics.totals.awardedValue)}
            subtitle="Celkový objem oceněných zakázek"
            icon={<ReportMoney size={21} strokeWidth={1.65} aria-hidden="true" />}
            color="emerald"
          />
          <KPICard
            title="Celkem poptávek"
            value={analytics.categoryProfit.length}
            subtitle="Počet poptávek v systému"
            icon={<ClipboardList size={21} strokeWidth={1.65} aria-hidden="true" />}
            color="blue"
          />
          <KPICard
            title="Poptaní subdodavatelé"
            value={analytics.suppliers.length}
            subtitle="Celkem oslovených dodavatelů"
            icon={<UsersGroup size={21} strokeWidth={1.65} aria-hidden="true" />}
            color="violet"
          />
          <KPICard
            title="Celkem nabídek"
            value={analytics.totals.offerCount}
            subtitle="Všechny přijaté nabídky"
            icon={<FileCheck size={21} strokeWidth={1.65} aria-hidden="true" />}
            color="amber"
          />
        </div>

        {/* Status Cards */}
        <div data-help-id="overview-status-cards" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <StatusCard
            type="tender"
            awardedValue={analytics.totalsByStatus.tender.awardedValue}
            sodCount={analytics.totalsByStatus.tender.sodCount}
            offerCount={analytics.totalsByStatus.tender.offerCount}
            formatMoney={formatMoney}
          />
          <StatusCard
            type="realization"
            awardedValue={analytics.totalsByStatus.realization.awardedValue}
            sodCount={analytics.totalsByStatus.realization.sodCount}
            offerCount={analytics.totalsByStatus.realization.offerCount}
            formatMoney={formatMoney}
          />
          <StatusCard
            type="archived"
            awardedValue={analytics.totalsByStatus.archived.awardedValue}
            sodCount={analytics.totalsByStatus.archived.sodCount}
            offerCount={analytics.totalsByStatus.archived.offerCount}
            formatMoney={formatMoney}
          />
        </div>

        {/* Suppliers Section */}
        <OverviewSection
          data-help-id="overview-supplier-analysis"
          id="suppliers"
          title="Analýza dodavatelů"
          subtitle="Hodnocení, četnost SOD, nabídky a úspěšnost"
          isOpen={sections.suppliers}
          onToggle={toggleSection}
          rightSlot={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSupplierExport}
                disabled={!selectedSupplier}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  selectedSupplier
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                }`}
                title={
                  selectedSupplier
                    ? "Exportovat analýzu dodavatele do PDF"
                    : "Vyberte dodavatele ve filtru"
                }
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          }
        >
          {/* Filter Inputs */}
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,1fr)_auto]">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Dodavatel
              </label>
              <Combobox
                items={supplierRows.map((supplier) => supplier.name)}
                inputValue={supplierQuery}
                onInputValueChange={(value) => setSupplierQuery(value)}
                onValueChange={(value) => setSupplierQuery(typeof value === "string" ? value : "")}
                clearable
                icon
                size="md"
              >
                <ComboboxInput
                  aria-label="Vyhledat dodavatele"
                  placeholder="Vyhledat dodavatele..."
                  startSlot={<Search className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                  className="tf-overview-filter-combobox mt-1"
                />
                <ComboboxContent className="tf-overview-filter-combobox-content z-[420]">
                  <ComboboxEmpty>Žádný dodavatel neodpovídá hledání.</ComboboxEmpty>
                  <ComboboxList className="max-h-[11.75rem] [scrollbar-gutter:stable]">
                    {(supplierName: string) => (
                      <ComboboxItem key={supplierName} value={supplierName}>
                        {supplierName}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Zaměření
              </label>
              <Combobox
                items={specializationOptions}
                inputValue={supplierSpecialization}
                onInputValueChange={(value) => setSupplierSpecialization(value)}
                onValueChange={(value) => setSupplierSpecialization(typeof value === "string" ? value : "")}
                clearable
                icon
                size="md"
              >
                <ComboboxInput
                  aria-label="Vyhledat zaměření"
                  placeholder="Všechna zaměření"
                  startSlot={<Search className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                  className="tf-overview-filter-combobox mt-1"
                />
                <ComboboxContent className="tf-overview-filter-combobox-content z-[420]">
                  <ComboboxEmpty>Žádné zaměření neodpovídá hledání.</ComboboxEmpty>
                  <ComboboxList className="max-h-[11.75rem] [scrollbar-gutter:stable]">
                    {(specialization: string) => (
                      <ComboboxItem key={specialization} value={specialization}>
                        {specialization}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetSupplierFilters}
                className="h-10 px-4 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset filtrů
              </button>
            </div>
          </div>

          {/* Charts Grid - 2x2 layout */}
          <div data-help-id="overview-charts" className="mb-6 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <SupplierBarChart
              items={topSuppliers.map((s) => ({
                label: s.name,
                value: s.sodCount,
                helper: `${s.offerCount} nabídek`,
              }))}
              title="Nejčastěji zasmluvňovaní"
              subtitle="Dodavatelé podle počtu SOD"
              color="emerald"
              valueFormatter={(value) => `${formatDecimal(value, { maximumFractionDigits: 0 })} SOD`}
            />
            <SupplierBarChart
              items={topSuppliers.map((s) => ({
                label: s.name,
                value: s.totalAwardedValue,
                helper: s.lastAwardedLabel || "Bez ocenění",
              }))}
              valueFormatter={(value) => compactCurrencyFormatter.format(value)}
              title="Nejvyšší objemy"
              subtitle="Dodavatelé podle oceněných zakázek"
              color="blue"
            />
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <StatusDistributionChart
                sodCount={statusCounts.sod}
                shortlistCount={statusCounts.shortlist}
                offerCount={statusCounts.offer}
                rejectedCount={statusCounts.rejected}
                contactedCount={statusCounts.contacted}
                sentCount={statusCounts.sent}
              />
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <BudgetDeviationGauge
                avgDeviationPercent={avgBudgetDeviation}
              />
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Seznam dodavatelů
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {filteredSuppliers.length} dodavatelů celkem
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllSuppliers((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {showAllSuppliers ? "Zobrazit méně" : "Zobrazit vše"}
              </button>
            </div>

            <SupplierTable
              suppliers={topSuppliers}
              onSupplierClick={(supplier) => setSupplierQuery(supplier.name)}
              selectedSupplierId={selectedSupplier?.id}
            />
          </div>

          {/* Selected Supplier Details */}
          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Nabídky vybraného dodavatele
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedSupplier ? selectedSupplier.name : "Vyberte dodavatele pro zobrazení detailů"}
                </p>
              </div>
            </div>

            {!supplierQuery.trim() ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                Vyberte dodavatele v poli „Dodavatel" pro zobrazení nabídek.
              </div>
            ) : !selectedSupplier ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                Upravte filtr tak, aby přesně odpovídal jednomu dodavateli.
              </div>
            ) : selectedSupplierOffers.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                Pro vybraného dodavatele zatím nejsou k dispozici žádné cenové nabídky.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Offers Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Projekt</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Poptávka</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cena</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Datum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedSupplierOffers.map((offer, index) => (
                        <tr key={`${offer.projectId}-${offer.categoryId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-100 font-medium">
                            {offer.projectName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {offer.categoryTitle}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold tabular-nums">
                            {formatMoney(offer.priceValue)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getOfferStatusMeta(offer.status).className}`}>
                              {getOfferStatusMeta(offer.status).label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {formatOfferDate(offer.date) || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Celkem oceněno
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(selectedSupplierSummary.totalAwardedValue)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Celkem zasmluvněno (realizace)
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(selectedSupplierSummary.totalSodRealizationValue)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Úspěšnost
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatPercent(selectedSupplierSummary.successRate)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {selectedSupplierSummary.sodCount} z {selectedSupplierSummary.offerCount} nabídek
                    </div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Nabídky", value: selectedSupplierSummary.offerCount, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
                    { label: "Užší výběr", value: selectedSupplierSummary.shortlistCount, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
                    { label: "Vítěz (SOD)", value: selectedSupplierSummary.sodCount, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
                    { label: "Zamítnuto", value: selectedSupplierSummary.rejectedCount, color: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
                      <div className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${item.color}`}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Average Diff */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Průměrná odchylka nabídek
                  </div>
                  <div className="space-y-2">
                    <div className={`text-sm ${
                      selectedSupplierSummary.avgDiffSodPercent !== null && selectedSupplierSummary.avgDiffSodPercent <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatAvgDiff(selectedSupplierSummary.avgDiffSodPercent, "SOD rozpočtem")}
                    </div>
                    <div className={`text-sm ${
                      selectedSupplierSummary.avgDiffPlanPercent !== null && selectedSupplierSummary.avgDiffPlanPercent <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatAvgDiff(selectedSupplierSummary.avgDiffPlanPercent, "plánem")}
                    </div>
                  </div>
                </div>

                {/* Monthly Chart */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                    Objem nabídek v čase (měsíce)
                  </div>
                  {selectedSupplierMonthlySeries.data.length === 0 || selectedSupplierMonthlySeries.years.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                      Pro časovou osu nejsou dostupná data s datem nabídky.
                    </div>
                  ) : (
                    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2" ref={chartRef}>
                      {selectedSupplierMonthlySeries.years.map((year, index) => {
                        const yearKey = year.toString();
                        const values = selectedSupplierMonthlySeries.data.map((row) => {
                          const value = row[yearKey];
                          return typeof value === "number" ? value : 0;
                        });
                        const labels = selectedSupplierMonthlySeries.data.map((row) => row.month.toString());
                        const total = values.reduce((sum, value) => sum + value, 0);
                        const color = monthlySparklinePalette[index % monthlySparklinePalette.length];

                        return (
                          <Sparkline
                            key={year}
                            data={values}
                            labels={labels}
                            color={color}
                            locale="cs-CZ"
                            className="min-w-0 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/35"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{year}</span>
                              <span className="w-max whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                                {formatMoney(total)}
                              </span>
                            </div>
                            <SparklineChart
                              aria-label={`Objem nabídek za rok ${year} podle měsíců`}
                              height={72}
                              curve={0.72}
                              fill
                              tooltip
                              renderTooltip={(point) => (
                                <div className="flex w-max items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white shadow-xl">
                                  <span className="text-slate-400">Měsíc {point.label}</span>
                                  <span className="font-semibold tabular-nums">{formatMoney(point.value)}</span>
                                </div>
                              )}
                            />
                            <div className="flex justify-between text-[0.6875rem] text-slate-400 dark:text-slate-500" aria-hidden="true">
                              <span>1</span>
                              <span>6</span>
                              <span>12</span>
                            </div>
                          </Sparkline>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </OverviewSection>

        {/* Trends Section */}
        <OverviewSection
          data-help-id="overview-trends"
          id="trends"
          title="Trendy v čase"
          subtitle="Počty a objemy staveb rozložené podle období realizace"
          isOpen={sections.trends}
          onToggle={toggleSection}
        >
          <MonthlyVolumeTrends trends={monthlyVolumeTrends} />
        </OverviewSection>


      </div>
    </div>
  );
};

export default ProjectOverview;
