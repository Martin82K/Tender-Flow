import React, { useRef } from "react";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/utils/overviewAnalytics";
import { getOfferStatusMeta } from "@/utils/offerStatus";
import { exportSupplierAnalysisToPDF } from "@/services/exportService";
import type { Project, ProjectDetails } from "@/types";
import html2canvas from "html2canvas";
import {
  Wallet,
  Target,
  Users,
  FolderKanban,
  Building2,
  Filter,
  FileText,
  Search,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { KPICard } from "@/shared/ui/overview/KPICard";
import { StatusCard } from "@/shared/ui/overview/StatusCard";
import { SupplierBarChart } from "@/shared/ui/overview/SupplierBarChart";
import { SupplierTable } from "@/shared/ui/overview/SupplierTable";
import { StatusDistributionChart } from "@/shared/ui/overview/StatusDistributionChart";
import { BudgetDeviationGauge } from "@/shared/ui/overview/BudgetDeviationGauge";
import { OverviewSection } from "@/features/projects/ui/OverviewSection";
import {
  formatOfferDate,
} from "@/features/projects/model/projectOverviewModel";
import { useProjectOverviewController } from "@/features/projects/model/useProjectOverviewController";

interface ProjectOverviewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  projects,
  projectDetails,
}) => {
  const {
    tenantLoading,
    tenantError,
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
    trendYears,
    analytics,
    statusCounts,
    avgBudgetDeviation,
    resetSupplierFilters,
  } = useProjectOverviewController({ projects, projectDetails });

  const formatMillions = (value: number) =>
    `${(value / 1_000_000).toFixed(1).replace(".", ",")} mil.`;

  const chartRef = useRef<HTMLDivElement | null>(null);

  const handleSupplierExport = () => {
    if (!selectedSupplier) return;
    const appUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "Tender Flow";

    const exportWithChart = async () => {
      if (!chartRef.current) {
        exportSupplierAnalysisToPDF(
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

      exportSupplierAnalysisToPDF(
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

    void exportWithChart();
  };

  const formatPercent = (value: number) => `${value.toFixed(1).replace(".", ",")} %`;

  const formatAvgDiff = (value: number | null, label: string) => {
    if (value === null) {
      return `Bez dat pro ${label}.`;
    }
    const isPositive = value >= 0;
    return `Nabídky jsou v průměru ${isPositive ? "nad" : "pod"} ${label} o ${formatPercent(
      Math.abs(value),
    )}.`;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="no-print">
        <Header title="Přehledy" subtitle="Analytika dodavatelů, výběrů a trendů" notificationSlot={<NotificationBell />} />
      </div>

      <div className="flex-1 space-y-6 p-6">
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
              <div>Tenant error: {tenantError ? (tenantError instanceof Error ? tenantError.message : "ano") : "ne"}</div>
            </div>
          </div>
        ) : null}

        {/* Filters Bar */}
        <div className="no-print flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
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
            <select
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
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 gap-0.5">
            {([
              { value: "all", label: "Vše" },
              { value: "active", label: "Aktivní" },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Objem zakázek"
            value={formatMoney(analytics.totals.awardedValue)}
            subtitle="Celkový objem oceněných zakázek"
            icon={<Wallet className="w-6 h-6" />}
            color="emerald"
          />
          <KPICard
            title="Celkem poptávek"
            value={analytics.categoryProfit.length}
            subtitle="Počet poptávek v systému"
            icon={<FolderKanban className="w-6 h-6" />}
            color="blue"
          />
          <KPICard
            title="Poptaní subdodavatelé"
            value={analytics.suppliers.length}
            subtitle="Celkem oslovených dodavatelů"
            icon={<Users className="w-6 h-6" />}
            color="violet"
          />
          <KPICard
            title="Celkem nabídek"
            value={analytics.totals.offerCount}
            subtitle="Všechny přijaté nabídky"
            icon={<Target className="w-6 h-6" />}
            color="amber"
          />
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Dodavatel
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                  list="supplier-suggestions"
                  placeholder="Vyhledat dodavatele..."
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <datalist id="supplier-suggestions">
                {supplierRows.map((supplier) => (
                  <option key={supplier.id} value={supplier.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Zaměření
              </label>
              <div className="relative">
                <select
                  value={supplierSpecialization}
                  onChange={(e) => setSupplierSpecialization(e.target.value)}
                  style={{ backgroundImage: "none" }}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-8 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Všechna zaměření</option>
                  {specializationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SupplierBarChart
              items={topSuppliers.map((s) => ({
                label: s.name,
                value: s.sodCount,
                helper: `${s.offerCount} nabídek`,
              }))}
              title="Nejčastěji zasmluvňovaní"
              subtitle="Dodavatelé podle počtu SOD"
              color="emerald"
            />
            <SupplierBarChart
              items={topSuppliers.map((s) => ({
                label: s.name,
                value: s.totalAwardedValue,
                helper: s.lastAwardedLabel || "Bez ocenění",
              }))}
              valueFormatter={formatMoney}
              title="Nejvyšší objemy"
              subtitle="Dodavatelé podle oceněných zakázek"
              color="blue"
            />
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <StatusDistributionChart
                sodCount={statusCounts.sod}
                shortlistCount={statusCounts.shortlist}
                offerCount={statusCounts.offer}
                rejectedCount={statusCounts.rejected}
                contactedCount={statusCounts.contacted}
                sentCount={statusCounts.sent}
              />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
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
                      {selectedSupplierSummary.successRate.toFixed(1).replace(".", ",")}%
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
                    <div className="h-56" ref={chartRef}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                        <LineChart data={selectedSupplierMonthlySeries.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                          <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            tickFormatter={(value) => formatMillions(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => formatMoney(value)}
                            labelFormatter={(label) => `Měsíc ${label}`}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                          />
                          <Legend />
                          {selectedSupplierMonthlySeries.years.map((year, index) => {
                            const palette = [
                              "#0EA5E9",
                              "#10B981",
                              "#F59E0B",
                              "#8B5CF6",
                              "#EC4899",
                              "#06B6D4",
                              "#EF4444",
                            ];
                            return (
                              <Line
                                key={year}
                                type="monotone"
                                dataKey={year.toString()}
                                stroke={palette[index % palette.length]}
                                strokeWidth={2}
                                dot={false}
                                name={year.toString()}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </OverviewSection>

        {/* Trends Section */}
        <OverviewSection
          id="trends"
          title="Trendy v čase"
          subtitle="Objemy zakázek a aktivita v jednotlivých letech"
          isOpen={sections.trends}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupplierBarChart
              items={analytics.yearTrends.map((t) => ({
                label: t.year.toString(),
                value: t.awardedValue,
                helper: `${t.sodCount} SOD`,
              }))}
              valueFormatter={formatMoney}
              title="Objem oceněných zakázek"
              subtitle="Podle roku ocenění"
              color="violet"
            />
            <SupplierBarChart
              items={analytics.yearTrends.map((t) => ({
                label: t.year.toString(),
                value: t.offerCount,
                helper: `${t.categoryCount} kategorií`,
              }))}
              title="Aktivita nabídek"
              subtitle="Počet nabídek podle roku"
              color="amber"
            />
          </div>
          {trendYears.length === 0 && (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              Pro trendové grafy nejsou zatím dostupná data s datem ocenění.
            </div>
          )}
        </OverviewSection>


      </div>
    </div>
  );
};

export default ProjectOverview;
