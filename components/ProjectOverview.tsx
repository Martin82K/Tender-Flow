import React, { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./Header";
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
import { useContactsQuery } from "../hooks/queries/useContactsQuery";
import { useOverviewTenantDataQuery } from "../hooks/queries/useOverviewTenantDataQuery";
import { buildOverviewAnalytics, formatMoney, type OverviewAnalytics } from "../utils/overviewAnalytics";
import { getOfferStatusMeta } from "../utils/offerStatus";
import { exportSupplierAnalysisToPDF } from "../services/exportService";
import { filterSuppliers } from "../utils/supplierFilters";
import { useAuth } from "../context/AuthContext";
import { isUserAdmin } from "../utils/helpers";
import type { Project, ProjectDetails, Subcontractor } from "../types";
import html2canvas from "html2canvas";
import {
  Wallet,
  Target,
  Users,
  FolderKanban,
  Building2,
  Filter,
  Printer,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
} from "lucide-react";
import { KPICard } from "./overview/KPICard";
import { StatusCard } from "./overview/StatusCard";
import { SupplierBarChart } from "./overview/SupplierBarChart";
import { SupplierTable } from "./overview/SupplierTable";
import { StatusDistributionChart } from "./overview/StatusDistributionChart";
import { BudgetDeviationGauge } from "./overview/BudgetDeviationGauge";

interface ProjectOverviewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
}

const SECTION_DEFAULTS = {
  suppliers: true,
  trends: true,
};

const resolveContact = (
  supplier: OverviewAnalytics["suppliers"][number],
  contacts: Subcontractor[],
) => {
  if (!contacts.length) return null;
  if (supplier.subcontractorId) {
    const byId = contacts.find((c) => c.id === supplier.subcontractorId);
    if (byId) return byId;
  }
  const normalized = supplier.name.toLowerCase();
  return contacts.find((c) => c.company?.toLowerCase() === normalized) || null;
};

const Section: React.FC<{
  id: keyof typeof SECTION_DEFAULTS;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: (id: keyof typeof SECTION_DEFAULTS) => void;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}> = ({ id, title, subtitle, isOpen, onToggle, children, rightSlot }) => {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-700/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isOpen ? "Skrýt" : "Zobrazit"}
          </button>
        </div>
      </div>
      {isOpen ? <div className="p-5">{children}</div> : null}
    </div>
  );
};

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  projects,
  projectDetails,
}) => {
  const { user } = useAuth();
  const { data: contacts = [] } = useContactsQuery();
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useOverviewTenantDataQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "tender" | "realization" | "archived">("all");
  const [scope, setScope] = useState<"tenant" | "project">("tenant");
  const [sections, setSections] = useState(SECTION_DEFAULTS);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSpecialization, setSupplierSpecialization] = useState("");

  const tenantProjects = tenantData?.projects ?? [];
  const tenantProjectDetails = tenantData?.projectDetails ?? {};
  const availableProjects = tenantProjects.length > 0 ? tenantProjects : projects;
  const availableProjectDetails =
    tenantProjects.length > 0 ? tenantProjectDetails : projectDetails;
  const isAdmin = isUserAdmin(user?.email);
  const showDebugBanner = useMemo(() => {
    if (!isAdmin) return false;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("debugOverview") === "1";
  }, [isAdmin]);

  useEffect(() => {
    if (scope !== "project") return;
    if (selectedProjectId === "all") return;
    if (availableProjects.length === 0) return;
    const exists = availableProjects.some((project) => project.id === selectedProjectId);
    if (!exists) {
      setSelectedProjectId("all");
    }
  }, [availableProjects, scope, selectedProjectId]);

  const filteredProjectDetails = useMemo(() => {
    if (scope === "tenant") return availableProjectDetails;
    if (selectedProjectId === "all") return availableProjectDetails;
    return { [selectedProjectId]: availableProjectDetails[selectedProjectId] };
  }, [availableProjectDetails, selectedProjectId, scope]);

  const analytics = useMemo(
    () => buildOverviewAnalytics(availableProjects, filteredProjectDetails, statusFilter),
    [availableProjects, filteredProjectDetails, statusFilter],
  );

  const supplierRows = useMemo(() => {
    const suppliers = [...analytics.suppliers].sort((a, b) => {
      if (b.sodCount !== a.sodCount) return b.sodCount - a.sodCount;
      return b.offerCount - a.offerCount;
    });

    return suppliers.map((supplier) => {
      const contact = resolveContact(supplier, contacts);
      return {
        ...supplier,
        rating: contact?.vendorRatingAverage,
        ratingCount: contact?.vendorRatingCount || 0,
        contact,
      };
    });
  }, [analytics.suppliers, contacts]);

  const specializationOptions = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((contact) => {
      (contact.specialization || []).forEach((item) => {
        if (item) set.add(item);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs-CZ"));
  }, [contacts]);

  const filteredSuppliers = useMemo(
    () => filterSuppliers(supplierRows, { query: supplierQuery, specialization: supplierSpecialization }),
    [supplierRows, supplierQuery, supplierSpecialization],
  );

  const selectedSupplier = useMemo(() => {
    const normalizedQuery = supplierQuery.trim().toLowerCase();
    if (!normalizedQuery) return null;
    const exactMatches = filteredSuppliers.filter(
      (supplier) => supplier.name.toLowerCase() === normalizedQuery,
    );
    if (exactMatches.length !== 1) return null;
    return exactMatches[0];
  }, [filteredSuppliers, supplierQuery]);

  const selectedSupplierOffers = useMemo(() => {
    if (!selectedSupplier) return [];
    return [...selectedSupplier.offers].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [selectedSupplier]);

  const selectedSupplierSummary = useMemo(() => {
    if (!selectedSupplier) {
      return {
        totalAwardedValue: 0,
        totalSodRealizationValue: 0,
        offerCount: 0,
        shortlistCount: 0,
        sodCount: 0,
        rejectedCount: 0,
        successRate: 0,
        avgDiffSodPercent: null as number | null,
        avgDiffPlanPercent: null as number | null,
      };
    }

    let totalAwardedValue = 0;
    let totalSodRealizationValue = 0;
    let offerCount = 0;
    let shortlistCount = 0;
    let sodCount = 0;
    let rejectedCount = 0;
    const sodDiffs: number[] = [];
    const planDiffs: number[] = [];

    selectedSupplier.offers.forEach((offer) => {
      totalAwardedValue += offer.priceValue;
      offerCount += 1;

      if (offer.status === "shortlist") shortlistCount += 1;
      if (offer.status === "sod") {
        sodCount += 1;
        if (offer.projectStatus === "realization") {
          totalSodRealizationValue += offer.priceValue;
        }
      }
      if (offer.status === "rejected") rejectedCount += 1;

      if (offer.sodBudget && offer.sodBudget > 0) {
        sodDiffs.push(((offer.priceValue - offer.sodBudget) / offer.sodBudget) * 100);
      }
      if (offer.planBudget && offer.planBudget > 0) {
        planDiffs.push(((offer.priceValue - offer.planBudget) / offer.planBudget) * 100);
      }
    });

    const avgDiffSodPercent =
      sodDiffs.length > 0 ? sodDiffs.reduce((sum, value) => sum + value, 0) / sodDiffs.length : null;
    const avgDiffPlanPercent =
      planDiffs.length > 0 ? planDiffs.reduce((sum, value) => sum + value, 0) / planDiffs.length : null;

    return {
      totalAwardedValue,
      totalSodRealizationValue,
      offerCount,
      shortlistCount,
      sodCount,
      rejectedCount,
      successRate: offerCount > 0 ? (sodCount / offerCount) * 100 : 0,
      avgDiffSodPercent,
      avgDiffPlanPercent,
    };
  }, [selectedSupplier]);

  const selectedSupplierMonthlySeries = useMemo(() => {
    if (!selectedSupplier) return { data: [], years: [] as number[] };
    const yearMap = new Map<number, number[]>();

    selectedSupplier.offers.forEach((offer) => {
      if (!offer.date) return;
      const parsed = new Date(offer.date);
      if (Number.isNaN(parsed.getTime())) return;
      const year = parsed.getFullYear();
      const monthIndex = parsed.getMonth();
      const values = yearMap.get(year) || Array.from({ length: 12 }, () => 0);
      values[monthIndex] += offer.priceValue;
      yearMap.set(year, values);
    });

    const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
    const data = Array.from({ length: 12 }, (_, index) => {
      const row: Record<string, number | string> = { month: (index + 1).toString() };
      years.forEach((year) => {
        row[year.toString()] = yearMap.get(year)?.[index] || 0;
      });
      return row;
    });

    return { data, years };
  }, [selectedSupplier]);

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

  const formatOfferDate = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("cs-CZ");
  };

  const topSuppliers = showAllSuppliers ? filteredSuppliers : filteredSuppliers.slice(0, 6);
  const trendYears = analytics.yearTrends.map((trend) => trend.year);
  const selectedProjectLabel =
    selectedProjectId === "all"
      ? "Všechny stavby"
      : availableProjects.find((project) => project.id === selectedProjectId)?.name || "Vybraný projekt";
  const selectedStatusLabel =
    statusFilter === "all"
      ? "Všechny stavy"
      : statusFilter === "tender"
        ? "Soutěž"
        : statusFilter === "realization"
          ? "Realizace"
          : "Archiv";
  const toggleSection = (id: keyof typeof SECTION_DEFAULTS) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const successRate = analytics.totals.offerCount > 0
    ? (analytics.totals.sodCount / analytics.totals.offerCount) * 100
    : 0;

  // Calculate status distribution from all offers
  const statusCounts = useMemo(() => {
    const counts = {
      sod: 0,
      shortlist: 0,
      offer: 0,
      rejected: 0,
      contacted: 0,
      sent: 0,
    };
    
    analytics.suppliers.forEach(supplier => {
      supplier.offers.forEach(offer => {
        if (offer.status === 'sod') counts.sod++;
        else if (offer.status === 'shortlist') counts.shortlist++;
        else if (offer.status === 'offer') counts.offer++;
        else if (offer.status === 'rejected') counts.rejected++;
        else if (offer.status === 'contacted') counts.contacted++;
        else if (offer.status === 'sent') counts.sent++;
      });
    });
    
    return counts;
  }, [analytics.suppliers]);

  // Calculate average budget deviation
  const avgBudgetDeviation = useMemo(() => {
    const deviations: number[] = [];
    
    analytics.suppliers.forEach(supplier => {
      supplier.offers.forEach(offer => {
        if (offer.sodBudget && offer.sodBudget > 0 && offer.priceValue > 0) {
          const deviation = ((offer.priceValue - offer.sodBudget) / offer.sodBudget) * 100;
          deviations.push(deviation);
        }
      });
    });
    
    if (deviations.length === 0) return null;
    return deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
  }, [analytics.suppliers]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="no-print">
        <Header title="Přehledy" subtitle="Analytika dodavatelů, výběrů a trendů" />
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
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="tenant">Celá společnost (tenant)</option>
            <option value="project">Vybraný projekt</option>
          </select>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={scope === "tenant"}
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">Všechny stavby</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">Všechny stavy</option>
            <option value="tender">Soutěž</option>
            <option value="realization">Realizace</option>
            <option value="archived">Archiv</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Tisk / PDF
            </button>
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
        <Section
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
              <select
                value={supplierSpecialization}
                onChange={(e) => setSupplierSpecialization(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Všechna zaměření</option>
                {specializationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSupplierQuery("");
                  setSupplierSpecialization("");
                }}
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
                      <ResponsiveContainer width="100%" height="100%">
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
        </Section>

        {/* Trends Section */}
        <Section
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
        </Section>


      </div>
    </div>
  );
};

export default ProjectOverview;
