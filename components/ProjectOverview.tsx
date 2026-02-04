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
import { buildOverviewChatContext } from "../utils/overviewChat";
import { sendOverviewChatMessage, type OverviewChatMessage } from "../services/overviewChatService";
import { exportSupplierAnalysisToPDF } from "../services/exportService";
import { filterSuppliers } from "../utils/supplierFilters";
import { useAuth } from "../context/AuthContext";
import { isUserAdmin } from "../utils/helpers";
import type { Project, ProjectDetails, Subcontractor } from "../types";
import html2canvas from "html2canvas";

interface ProjectOverviewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
}

const SECTION_DEFAULTS = {
  suppliers: true,
  trends: true,
  chatbot: true,
};

const getRatingLabel = (rating?: number) => {
  if (!rating || rating <= 0) return "Bez hodnocení";
  return rating.toFixed(1);
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
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 bg-slate-50/80 dark:bg-slate-900/80">
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300/70 dark:hover:bg-slate-700 transition"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isOpen ? "unfold_less" : "unfold_more"}
            </span>
            {isOpen ? "Skrýt" : "Zobrazit"}
          </button>
        </div>
      </div>
      {isOpen ? <div className="p-5">{children}</div> : null}
    </div>
  );
};

const BarList: React.FC<{
  items: { label: string; value: number; helper?: string }[];
  valueFormatter?: (value: number) => string;
}> = ({ items, valueFormatter }) => {
  if (items.length === 0) {
    return <div className="text-sm text-slate-500">Zatím bez dat.</div>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max((item.value / max) * 100, 4);
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-44 text-sm text-slate-700 dark:text-slate-200 truncate">
              {item.label}
            </div>
            <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-24 text-right text-sm text-slate-600 dark:text-slate-300">
              {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString("cs-CZ")}
            </div>
            {item.helper ? (
              <div className="hidden md:block w-32 text-xs text-slate-400">{item.helper}</div>
            ) : null}
          </div>
        );
      })}
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
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<OverviewChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
  const chatContext = useMemo(
    () =>
      buildOverviewChatContext(
        analytics,
        `${scope === "tenant" ? "Celý tenant" : selectedProjectLabel} · ${selectedStatusLabel}`,
      ),
    [analytics, selectedProjectLabel, selectedStatusLabel, scope],
  );

  const toggleSection = (id: keyof typeof SECTION_DEFAULTS) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    setChatLoading(true);
    setChatError(null);
    const nextMessages = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput("");

    try {
      const response = await sendOverviewChatMessage(chatContext, nextMessages.slice(-12));
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response || "Model nevrátil odpověď." },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznámá chyba";
      setChatError(message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-100 dark:bg-slate-950">
      <div className="no-print">
        <Header title="Přehledy" subtitle="Analytika dodavatelů, výběrů a trendů" />
      </div>

      <div className="flex-1 space-y-6 p-6">
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
        <div className="no-print flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl px-4 py-3 shadow-sm">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Filtry
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className="h-9 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="tenant">Celá společnost (tenant)</option>
            <option value="project">Vybraný projekt</option>
          </select>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={scope === "tenant"}
            className="h-9 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
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
            className="h-9 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
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
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 transition"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Tisk / PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 p-4 border border-slate-200/70 dark:border-slate-700/70">
            <div className="text-xs uppercase tracking-wide text-slate-500">Objem zakázek</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {formatMoney(analytics.totals.awardedValue)}
            </div>
          </div>
          <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 p-4 border border-slate-200/70 dark:border-slate-700/70">
            <div className="text-xs uppercase tracking-wide text-slate-500">Úspěšnost VŘ</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {analytics.totals.offerCount > 0
                ? `${((analytics.totals.sodCount / analytics.totals.offerCount) * 100).toFixed(1)} %`
                : "0 %"}
            </div>
          </div>
          <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 p-4 border border-slate-200/70 dark:border-slate-700/70">
            <div className="text-xs uppercase tracking-wide text-slate-500">Počet dodavatelů</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {analytics.suppliers.length}
            </div>
          </div>
          <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 p-4 border border-slate-200/70 dark:border-slate-700/70">
            <div className="text-xs uppercase tracking-wide text-slate-500">Kategorie s daty</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {analytics.categoryProfit.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { key: "tender", label: "Soutěž", accent: "text-sky-600" },
            { key: "realization", label: "Realizace", accent: "text-emerald-600" },
            { key: "archived", label: "Archiv", accent: "text-slate-600" },
          ] as const).map((item) => (
            <div
              key={item.key}
              className="rounded-xl bg-white/90 dark:bg-slate-900/80 p-4 border border-slate-200/70 dark:border-slate-700/70"
            >
              <div className={`text-xs uppercase tracking-wide ${item.accent}`}>{item.label}</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                <div>Objem: {formatMoney(analytics.totalsByStatus[item.key].awardedValue)}</div>
                <div>SOD: {analytics.totalsByStatus[item.key].sodCount}</div>
                <div>Nabídky: {analytics.totalsByStatus[item.key].offerCount}</div>
              </div>
            </div>
          ))}
        </div>

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
                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200/40 dark:border-slate-700/40 cursor-not-allowed"
                }`}
                title={
                  selectedSupplier
                    ? "Exportovat analýzu dodavatele do PDF"
                    : "Vyberte dodavatele ve filtru"
                }
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => setShowAllSuppliers((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {showAllSuppliers ? "Zobrazit méně" : "Zobrazit vše"}
              </button>
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Dodavatel</label>
              <input
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                list="supplier-suggestions"
                placeholder="Vyhledat dodavatele..."
                className="mt-1 w-full h-9 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
              />
              <datalist id="supplier-suggestions">
                {supplierRows.map((supplier) => (
                  <option key={supplier.id} value={supplier.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Zaměření</label>
              <select
                value={supplierSpecialization}
                onChange={(e) => setSupplierSpecialization(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
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
                className="h-9 px-4 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Reset filtrů
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nejčastěji zasmluvňovaní dodavatelé
              </div>
              <BarList
                items={topSuppliers.map((supplier) => ({
                  label: supplier.name,
                  value: supplier.sodCount,
                  helper: `${supplier.offerCount} nabídek`,
                }))}
              />
            </div>

            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nejvyšší objem oceněných zakázek
              </div>
              <BarList
                items={topSuppliers.map((supplier) => ({
                  label: supplier.name,
                  value: supplier.totalAwardedValue,
                  helper: supplier.lastAwardedLabel || "Bez ocenění",
                }))}
                valueFormatter={formatMoney}
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200/70 dark:border-slate-700/70">
                  <th className="py-2 pr-4">Dodavatel</th>
                  <th className="py-2 pr-4">Hodnocení</th>
                  <th className="py-2 pr-4">Nabídky</th>
                  <th className="py-2 pr-4">SOD</th>
                  <th className="py-2 pr-4">Úspěšnost</th>
                  <th className="py-2 pr-4">Poslední ocenění</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-4 text-slate-800 dark:text-slate-100">{supplier.name}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {supplier.rating && supplier.rating > 0 ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            {Array.from({ length: 5 }, (_, index) => {
                              const starValue = index + 1;
                              const isFilled = supplier.rating >= starValue;
                              return (
                                <span
                                  key={starValue}
                                  className={`material-symbols-rounded text-[16px] ${
                                    isFilled
                                      ? "text-amber-400"
                                      : "text-slate-300 dark:text-slate-600"
                                  }`}
                                >
                                  {isFilled ? "star" : "star_outline"}
                                </span>
                              );
                            })}
                          </span>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {supplier.rating.toFixed(1).replace(".", ",")}
                          </span>
                          {supplier.ratingCount ? (
                            <span className="text-xs text-slate-400">
                              {supplier.ratingCount}×
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        getRatingLabel(supplier.rating)
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{supplier.offerCount}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{supplier.sodCount}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {supplier.offerCount > 0
                        ? `${((supplier.sodCount / supplier.offerCount) * 100).toFixed(1)} %`
                        : "0 %"}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {supplier.lastAwardedLabel || "Bez ocenění"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/60 p-4">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nabídky vybraného dodavatele
            </div>
            {!supplierQuery.trim() ? (
              <div className="mt-2 text-sm text-slate-500">
                Vyberte dodavatele v poli „Dodavatel“ pro zobrazení nabídek.
              </div>
            ) : !selectedSupplier ? (
              <div className="mt-2 text-sm text-slate-500">
                Upravte filtr tak, aby přesně odpovídal jednomu dodavateli.
              </div>
            ) : selectedSupplierOffers.length === 0 ? (
              <div className="mt-2 text-sm text-slate-500">
                Pro vybraného dodavatele zatím nejsou k dispozici žádné cenové nabídky.
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200/70 dark:border-slate-700/70">
                        <th className="py-2 pr-4">Projekt</th>
                        <th className="py-2 pr-4">Poptávka</th>
                        <th className="py-2 pr-4">Cena</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Datum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupplierOffers.map((offer, index) => (
                        <tr key={`${offer.projectId}-${offer.categoryId}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-3 pr-4 text-slate-800 dark:text-slate-100">
                            {offer.projectName}
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                            {offer.categoryTitle}
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 font-semibold">
                            {formatMoney(offer.priceValue)}
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${getOfferStatusMeta(offer.status).className}`}
                            >
                              {getOfferStatusMeta(offer.status).label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                            {formatOfferDate(offer.date) || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Celkem oceněno
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                      {formatMoney(selectedSupplierSummary.totalAwardedValue)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Celkem zasmluvněno (realizace)
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                      {formatMoney(selectedSupplierSummary.totalSodRealizationValue)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Úspěšnost</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                      {selectedSupplierSummary.successRate.toFixed(1).replace(".", ",")} %
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedSupplierSummary.sodCount} z {selectedSupplierSummary.offerCount} nabídek
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Nabídky</div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {selectedSupplierSummary.offerCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Užší výběr</div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {selectedSupplierSummary.shortlistCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Vítěz (SOD)</div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {selectedSupplierSummary.sodCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Zamítnuto</div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {selectedSupplierSummary.rejectedCount}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Průměrná odchylka nabídek
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div
                      className={
                        selectedSupplierSummary.avgDiffSodPercent !== null &&
                        selectedSupplierSummary.avgDiffSodPercent <= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      }
                    >
                      {formatAvgDiff(selectedSupplierSummary.avgDiffSodPercent, "SOD rozpočtem")}
                    </div>
                    <div
                      className={
                        selectedSupplierSummary.avgDiffPlanPercent !== null &&
                        selectedSupplierSummary.avgDiffPlanPercent <= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      }
                    >
                      {formatAvgDiff(selectedSupplierSummary.avgDiffPlanPercent, "plánem")}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Objem nabídek v čase (měsíce)
                  </div>
                  {selectedSupplierMonthlySeries.data.length === 0 ||
                  selectedSupplierMonthlySeries.years.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">
                      Pro časovou osu nejsou dostupná data s datem nabídky.
                    </div>
                  ) : (
                    <div className="mt-3 h-56" ref={chartRef}>
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
                            labelStyle={{ color: "#334155" }}
                          />
                          <Legend />
                          {selectedSupplierMonthlySeries.years.map((year, index) => {
                            const palette = [
                              "#38bdf8",
                              "#22c55e",
                              "#f59e0b",
                              "#a855f7",
                              "#f97316",
                              "#14b8a6",
                              "#e11d48",
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

        <Section
          id="trends"
          title="Trendy v čase"
          subtitle="Objemy zakázek a aktivita v jednotlivých letech"
          isOpen={sections.trends}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Objem oceněných zakázek po letech
              </div>
              <BarList
                items={analytics.yearTrends.map((trend) => ({
                  label: trend.year.toString(),
                  value: trend.awardedValue,
                  helper: `${trend.sodCount} SOD`,
                }))}
                valueFormatter={formatMoney}
              />
            </div>
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Aktivita nabídek
              </div>
              <BarList
                items={analytics.yearTrends.map((trend) => ({
                  label: trend.year.toString(),
                  value: trend.offerCount,
                  helper: `${trend.categoryCount} kategorií`,
                }))}
              />
            </div>
          </div>
          {trendYears.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">
              Pro trendové grafy nejsou zatím dostupná data s datem ocenění.
            </div>
          ) : null}
        </Section>

        <Section
          id="chatbot"
          title="AI chatbot nad daty"
          subtitle="Napojeno na OpenRouter přes uložený klíč v administraci"
          isOpen={sections.chatbot}
          onToggle={toggleSection}
        >
          <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="space-y-3 max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                {chatMessages.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Zeptejte se na dodavatele, trendy nebo ziskovost.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "assistant"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          : "bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
                        {msg.role === "assistant" ? "AI" : "Vy"}
                      </div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))
                )}
              </div>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-200"
                placeholder="Zeptejte se na dodavatele, trendy nebo ziskovost..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <div className="flex items-center justify-between">
                {chatError ? (
                  <div className="text-xs text-rose-500">{chatError}</div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Kontext: {selectedProjectLabel}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white disabled:opacity-60"
                >
                  {chatLoading ? "Odesílám..." : "Odeslat"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Rychlé dotazy
              </div>
              <div className="flex flex-col gap-2">
                {[
                  "Kteří dodavatelé mají nejvyšší úspěšnost?",
                  "Jak se vyvíjí objem zakázek meziročně?",
                  "Které části jsou dlouhodobě ztrátové?",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChatInput(item)}
                    className="text-left text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};
