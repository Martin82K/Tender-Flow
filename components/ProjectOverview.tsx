import React, { useMemo, useState } from "react";
import { Header } from "./Header";
import { useContactsQuery } from "../hooks/queries/useContactsQuery";
import { buildOverviewAnalytics, formatMoney, type OverviewAnalytics } from "../utils/overviewAnalytics";
import { buildOverviewChatContext } from "../utils/overviewChat";
import { sendOverviewChatMessage, type OverviewChatMessage } from "../services/overviewChatService";
import { filterSuppliers } from "../utils/supplierFilters";
import type { Project, ProjectDetails, Subcontractor } from "../types";

interface ProjectOverviewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
}

const SECTION_DEFAULTS = {
  suppliers: true,
  profitability: true,
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
  const { data: contacts = [] } = useContactsQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "tender" | "realization" | "archived">("all");
  const [scope, setScope] = useState<"tenant" | "project">("tenant");
  const [sections, setSections] = useState(SECTION_DEFAULTS);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSpecialization, setSupplierSpecialization] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<OverviewChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const filteredProjectDetails = useMemo(() => {
    if (scope === "tenant") return projectDetails;
    if (selectedProjectId === "all") return projectDetails;
    return { [selectedProjectId]: projectDetails[selectedProjectId] };
  }, [projectDetails, selectedProjectId, scope]);

  const analytics = useMemo(
    () => buildOverviewAnalytics(projects, filteredProjectDetails, statusFilter),
    [projects, filteredProjectDetails, statusFilter],
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

  const topSuppliers = showAllSuppliers ? filteredSuppliers : filteredSuppliers.slice(0, 6);
  const sortedCategories = analytics.categoryProfit;
  const topCategories = showAllCategories ? sortedCategories : sortedCategories.slice(0, 8);
  const topProfitable = topCategories.filter((category) => category.profit >= 0);
  const topLosses = topCategories.filter((category) => category.profit < 0);

  const trendYears = analytics.yearTrends.map((trend) => trend.year);
  const selectedProjectLabel =
    selectedProjectId === "all"
      ? "Všechny stavby"
      : projects.find((project) => project.id === selectedProjectId)?.name || "Vybraný projekt";
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
            {projects.map((project) => (
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
            <button
              type="button"
              onClick={() => setShowAllSuppliers((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {showAllSuppliers ? "Zobrazit méně" : "Zobrazit vše"}
            </button>
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
                      {getRatingLabel(supplier.rating)}
                      {supplier.ratingCount ? ` (${supplier.ratingCount})` : ""}
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
        </Section>

        <Section
          id="profitability"
          title="Přehled ziskovosti částí"
          subtitle="Které části jsou nejziskovější a kde se nejčastěji prodělává"
          isOpen={sections.profitability}
          onToggle={toggleSection}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowAllCategories((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {showAllCategories ? "Zobrazit méně" : "Zobrazit vše"}
            </button>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nejziskovější části
              </div>
              <BarList
                items={topProfitable.map((category) => ({
                  label: category.label,
                  value: category.profit,
                  helper: category.projectName,
                }))}
                valueFormatter={formatMoney}
              />
            </div>
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nejčastěji ztrátové části
              </div>
              <BarList
                items={topLosses.map((category) => ({
                  label: category.label,
                  value: Math.abs(category.profit),
                  helper: category.projectName,
                }))}
                valueFormatter={formatMoney}
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200/70 dark:border-slate-700/70">
                  <th className="py-2 pr-4">Část / Výběr</th>
                  <th className="py-2 pr-4">Projekt</th>
                  <th className="py-2 pr-4">Rozpočet</th>
                  <th className="py-2 pr-4">Vítězná cena</th>
                  <th className="py-2 pr-4">Zisk / ztráta</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-4 text-slate-800 dark:text-slate-100">{category.label}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{category.projectName}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {formatMoney(category.revenue)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {formatMoney(category.cost)}
                    </td>
                    <td className={`py-3 pr-4 font-medium ${category.profit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {formatMoney(category.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
