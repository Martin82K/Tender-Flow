import type { Bid, DemandCategory } from "@/types";
import type { AgentSkill } from "@features/agent/skills/types";
import {
  formatCurrency,
  getActiveProjectContext,
  keywordScore,
  normalizeText,
} from "@features/agent/skills/runtimeHelpers";

const EVALUATION_PROMPT =
  "Jsi vedoucí projektu stavebního řízení s přímou vazbou na ekonomiku i realizaci stavby. " +
  "Umíš správně zhodnotit situaci a interpretovat data v detailním reportu pomocí tabulek, grafů a dalších prostředků. " +
  "Vyjadřuj nejen KPI, ale i rizika. Tvým cílem je nestranné zhodnocení aktuálně dostupných informací " +
  "a být majákem skutečnosti pro lepší rozhodování. Předpokládej, že výstup bude prezentován vedení společnosti.";

const keywords = [
  "detailni briefing projektu",
  "detailní briefing projektu",
  "detailni report projektu",
  "detailní report projektu",
  "podrobny report projektu",
  "podrobný report projektu",
  "detailni shrnuti projektu",
  "detailní shrnutí projektu",
  "kpi projektu",
  "rizika projektu",
  "zhodnoceni projektu",
  "zhodnocení projektu",
];

const statusLabel: Record<string, string> = {
  open: "Otevřeno",
  negotiating: "V jednání",
  closed: "Uzavřeno",
  sod: "SOD",
};

const bidStatusLabel: Record<string, string> = {
  contacted: "Kontaktován",
  sent: "Posláno",
  offer: "Nabídka",
  shortlist: "Shortlist",
  sod: "SOD",
  rejected: "Nevybrán",
};

const DETAIL_MARKERS = [
  "detailni",
  "detailní",
  "detailnejsi",
  "detailnější",
  "podro",
  "kpi",
  "rizik",
  "report",
  "zhodnoc",
  "analy",
];

const esc = (value: string): string => value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ratio = (num: number, den: number): string => {
  if (den <= 0) return "n/a";
  return `${((num / den) * 100).toFixed(1)} %`;
};

const bar = (value: number, total: number, width = 22): string => {
  if (total <= 0) return "░".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((value / total) * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
};

const sumAmendments = (categories: DemandCategory[]): number =>
  categories.reduce((acc, item) => acc + toNumber(item.sodBudget) - toNumber(item.planBudget), 0);

const getBidsForCategory = (bids: Record<string, Bid[]>, categoryId: string): Bid[] => bids[categoryId] || [];

const collectBidStats = (bidsByCategory: Record<string, Bid[]>) => {
  const allBids = Object.values(bidsByCategory).flat();

  const byStatus = allBids.reduce<Record<string, number>>((acc, bid) => {
    acc[bid.status] = (acc[bid.status] || 0) + 1;
    return acc;
  }, {});

  const byRound = allBids.reduce<Record<string, number>>((acc, bid) => {
    const key = String(bid.selectionRound ?? 0);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byVendor = allBids.reduce<Record<string, number>>((acc, bid) => {
    const key = bid.companyName || "Neznámý dodavatel";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topVendors = Object.entries(byVendor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    allBids,
    byStatus,
    byRound,
    topVendors,
  };
};

const buildStatusChart = (categories: DemandCategory[]): string => {
  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[category.status] = (acc[category.status] || 0) + 1;
    return acc;
  }, {});

  const total = categories.length;

  const lines = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${statusLabel[status] || status}: ${bar(count, total)} ${count}`);

  return lines.length > 0 ? lines.join("\n") : "Bez kategorií";
};

const buildDiffChart = (categories: DemandCategory[]): string => {
  const top = [...categories]
    .map((item) => ({
      title: item.title,
      diff: toNumber(item.sodBudget) - toNumber(item.planBudget),
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 6);

  const maxAbs = Math.max(...top.map((item) => Math.abs(item.diff)), 0);

  const lines = top.map((item) => {
    const abs = Math.abs(item.diff);
    const sign = item.diff >= 0 ? "+" : "-";
    return `${esc(item.title)}: ${bar(abs, maxAbs)} ${sign}${formatCurrency(abs)}`;
  });

  return lines.length > 0 ? lines.join("\n") : "Bez rozpočtových odchylek";
};

export const deepProjectBriefingSkill: AgentSkill = {
  manifest: {
    id: "deep-project-briefing",
    name: "Detailní reporting projektu",
    description: "Nestranný detailní report projektu s KPI, riziky, tabulkami a grafy.",
    keywords,
    risk: "read",
    requiresProject: true,
  },
  match: (input) => {
    const normalized = normalizeText(input.userMessage);
    const baseScore = keywordScore(input.userMessage, keywords);
    const hasProject = !!getActiveProjectContext(input.runtime);
    const hasDetailIntent = DETAIL_MARKERS.some((marker) => normalized.includes(marker));

    if (!hasDetailIntent) return Math.max(0, baseScore - 0.35);
    if (!hasProject) return Math.max(0, baseScore - 0.15);

    return Math.min(1, Math.max(0.5, baseScore + 0.35));
  },
  run: (input) => {
    const active = getActiveProjectContext(input.runtime);

    if (!active) {
      return {
        reply:
          "Pro detailní reporting potřebuji aktivní projekt. Otevři prosím konkrétní stavbu a zkus znovu požadavek: detailní report projektu.",
      };
    }

    const { project, details } = active;
    const categories = details.categories ?? [];
    const bidsByCategory = details.bids ?? {};

    const openCategories = categories.filter((item) => item.status === "open" || item.status === "negotiating");
    const closedCategories = categories.filter((item) => item.status === "closed" || item.status === "sod");

    const planSum = categories.reduce((acc, item) => acc + toNumber(item.planBudget), 0);
    const sodSum = categories.reduce((acc, item) => acc + toNumber(item.sodBudget), 0);
    const delta = sodSum - planSum;

    const investorBase = toNumber(details.investorFinancials?.sodPrice);
    const investorAmendments = (details.investorFinancials?.amendments || []).reduce(
      (acc, amendment) => acc + toNumber(amendment.price),
      0,
    );
    const investorCurrent = investorBase + investorAmendments;
    const internalPlannedCost = toNumber(details.plannedCost);

    const bidStats = collectBidStats(bidsByCategory);
    const deadlineRisk = categories.filter(
      (item) =>
        Boolean(item.deadline) &&
        (item.status === "open" || item.status === "negotiating") &&
        new Date(item.deadline as string).getTime() - Date.now() <= 1000 * 60 * 60 * 24 * 21,
    );
    const noBidRisk = openCategories.filter((item) => getBidsForCategory(bidsByCategory, item.id).length === 0);
    const negativeBudgetRisk = categories.filter((item) => toNumber(item.sodBudget) - toNumber(item.planBudget) < 0);

    const topBudgetRisks = [...categories]
      .map((item) => ({
        title: item.title,
        diff: toNumber(item.sodBudget) - toNumber(item.planBudget),
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5);

    const categoriesTable = categories
      .map((item) => {
        const bidsCount = getBidsForCategory(bidsByCategory, item.id).length;
        const diff = toNumber(item.sodBudget) - toNumber(item.planBudget);
        const diffLabel = `${diff >= 0 ? "+" : "-"}${formatCurrency(Math.abs(diff))}`;

        return `| ${esc(item.title)} | ${statusLabel[item.status] || item.status} | ${item.deadline || "-"} | ${item.realizationStart || "-"} | ${item.realizationEnd || "-"} | ${bidsCount} | ${formatCurrency(toNumber(item.planBudget))} | ${formatCurrency(toNumber(item.sodBudget))} | ${diffLabel} |`;
      })
      .join("\n");

    const bidsStatusTable = Object.entries(bidStats.byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `| ${bidStatusLabel[status] || status} | ${count} |`)
      .join("\n");

    const bidsRoundsTable = Object.entries(bidStats.byRound)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([round, count]) => `| ${round} | ${count} |`)
      .join("\n");

    const topVendorTable = bidStats.topVendors
      .map(([vendor, count]) => `| ${esc(vendor)} | ${count} |`)
      .join("\n");

    const additionsCount = details.investorFinancials?.amendments?.length || 0;

    const riskLines = [
      `- Termínové riziko (<=21 dní, otevřené): **${deadlineRisk.length}** kategorií`,
      `- Obchodní riziko (otevřená kategorie bez nabídky): **${noBidRisk.length}** kategorií`,
      `- Rozpočtové riziko (negativní odchylka plan vs SOD): **${negativeBudgetRisk.length}** kategorií`,
    ];

    if (topBudgetRisks.length > 0) {
      riskLines.push("- Největší negativní odchylky:");
      topBudgetRisks.forEach((item, index) => {
        if (item.diff >= 0) return;
        riskLines.push(`  ${index + 1}. ${esc(item.title)}: -${formatCurrency(Math.abs(item.diff))}`);
      });
    }

    const response = [
      `## Detailní report projektu ${project.name}`,
      "",
      `> Hodnoticí rámec použitý ve skillu: ${EVALUATION_PROMPT}`,
      "",
      "### Executive summary",
      `- Projekt: **${project.name}** (${project.id})`,
      `- Lokalita: **${details.location || project.location || "neuvedeno"}**`,
      `- Investor: **${details.investor || "neuvedeno"}**`,
      `- Fáze: **${project.status}**`,
      `- Plánovaný konec: **${details.finishDate || "neuvedeno"}**`,
      `- Hlavní stavbyvedoucí: **${details.siteManager || "neuvedeno"}**`,
      `- Stavbyvedoucí: **${details.constructionManager || "neuvedeno"}**`,
      `- Stavební technik: **${details.constructionTechnician || "neuvedeno"}**`,
      `- Kategorie: **${categories.length}** (otevřeno ${openCategories.length}, uzavřeno ${closedCategories.length})`,
      `- Nabídky celkem: **${bidStats.allBids.length}**`,
      `- Hrubá odchylka (SOD vs interní plán kategorií): **${delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))}** (${ratio(sodSum, Math.max(planSum, 1))})`,
      "",
      "### KPI přehled",
      "| KPI | Hodnota |",
      "|---|---:|",
      `| Interní plán kategorií | ${formatCurrency(planSum)} |`,
      `| SOD kategorií | ${formatCurrency(sodSum)} |`,
      `| Odchylka SOD vs plán | ${delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))} |`,
      `| Interní plánovaný náklad projektu | ${formatCurrency(internalPlannedCost)} |`,
      `| Investor SOD base | ${formatCurrency(investorBase)} |`,
      `| Investor dodatky | ${formatCurrency(investorAmendments)} (${additionsCount}x) |`,
      `| Investor current | ${formatCurrency(investorCurrent)} |`,
      `| Kategorie s deadline <= 21 dní | ${deadlineRisk.length} |`,
      `| Otevřené kategorie bez nabídky | ${noBidRisk.length} |`,
      "",
      "### Grafy (ASCII)",
      "```text",
      "Kategorie podle stavu",
      buildStatusChart(categories),
      "",
      "Top rozpočtové odchylky (abs)",
      buildDiffChart(categories),
      "```",
      "",
      "### Kategorie a ekonomika (detail)",
      "| Kategorie | Stav | Deadline | Realizace od | Realizace do | Nabídky | Plán | SOD | Odchylka |",
      "|---|---|---|---|---|---:|---:|---:|---:|",
      categoriesTable || "| - | - | - | - | - | 0 | 0 Kč | 0 Kč | 0 Kč |",
      "",
      "### Nabídky (detail)",
      "| Stav nabídky | Počet |",
      "|---|---:|",
      bidsStatusTable || "| Bez dat | 0 |",
      "",
      "| Kolo výběru | Počet nabídek |",
      "|---|---:|",
      bidsRoundsTable || "| 0 | 0 |",
      "",
      "| Dodavatel | Počet nabídek |",
      "|---|---:|",
      topVendorTable || "| Bez dat | 0 |",
      "",
      "### Rizika",
      ...riskLines,
      "",
      "### Doporučené kroky pro vedení (nestranné)",
      "1. U kategorií s negativní odchylkou potvrdit příčinu (scope change vs cenová eskalace vs odhad).",
      "2. U otevřených kategorií bez nabídek okamžitě navýšit akviziční aktivitu dodavatelů.",
      "3. U kategorií s blízkým deadlinem vyžádat denní checkpoint do uzavření VŘ.",
      "4. Porovnat investor current (`SOD + dodatky`) s interním plánovaným nákladem projektu.",
      "",
      "### Datová stopa reportu",
      `- Audience: ${input.runtime.audience}`,
      `- Context scopes: ${input.runtime.contextScopes.join(", ") || "none"}`,
      `- Aktivní tab: ${input.runtime.activeProjectTab || "neuvedeno"}`,
      `- Kontakty v runtime: ${input.runtime.contacts.length}`,
      `- Kategorie v reportu: ${categories.length}`,
      `- Bids zohledněno: ${bidStats.allBids.length}`,
      `- Součet odchylek kategorií: ${delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))}`,
      `- Doplňková kontrola (sum odchylek): ${sumAmendments(categories) >= 0 ? "+" : "-"}${formatCurrency(Math.abs(sumAmendments(categories)))}`,
      `- Kontext policy: ${input.runtime.contextPolicyVersion}`,
    ];

    return {
      reply: response.join("\n"),
    };
  },
};
