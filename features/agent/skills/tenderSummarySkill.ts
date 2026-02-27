import type { Bid } from "@/types";
import type { AgentSkill } from "@features/agent/skills/types";
import { getActiveProjectContext, keywordScore } from "@features/agent/skills/runtimeHelpers";

const keywords = [
  "vyberko",
  "výběrko",
  "vyberove rizeni",
  "výběrové řízení",
  "tender",
  "poptavka",
  "poptávka",
  "pipeline",
];

const countBids = (bidsByCategory: Record<string, Bid[]> | undefined) => {
  if (!bidsByCategory) return 0;
  return Object.values(bidsByCategory).reduce((acc, item) => acc + item.length, 0);
};

export const tenderSummarySkill: AgentSkill = {
  manifest: {
    id: "tender-summary",
    name: "Sumarizace výběrka",
    description: "Stručný přehled stavu výběrových řízení v aktivním projektu.",
    keywords,
    risk: "read",
    requiresProject: true,
  },
  match: (input) => {
    const baseScore = keywordScore(input.userMessage, keywords);
    const hasProject = !!getActiveProjectContext(input.runtime);

    if (!hasProject) return Math.max(0, baseScore - 0.2);
    return Math.min(1, baseScore + 0.22);
  },
  run: (input) => {
    const active = getActiveProjectContext(input.runtime);

    if (!active) {
      return {
        reply:
          "Abych mohl shrnout výběrko, potřebuji aktivní projekt. Otevři stavbu a napiš třeba: shrň výběrové řízení.",
      };
    }

    const { project, details } = active;
    const categories = details.categories ?? [];
    const bids = details.bids ?? {};
    const totalBids = countBids(bids);

    const openCategories = categories.filter((item) => item.status === "open" || item.status === "negotiating");
    const closedCategories = categories.filter((item) => item.status === "sod" || item.status === "closed");

    const ranking = categories
      .map((category) => ({
        title: category.title,
        bidsCount: bids[category.id]?.length ?? 0,
      }))
      .sort((a, b) => b.bidsCount - a.bidsCount)
      .slice(0, 3);

    const lines = [
      `Sumarizace výběrových řízení pro projekt ${project.name}`,
      `- Celkem kategorií: ${categories.length}`,
      `- Otevřené / rozjednané: ${openCategories.length}`,
      `- Uzavřené (SOD/closed): ${closedCategories.length}`,
      `- Celkový počet nabídek: ${totalBids}`,
    ];

    if (ranking.length > 0) {
      lines.push("- TOP kategorie podle počtu nabídek:");
      ranking.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item.title}: ${item.bidsCount} nabídek`);
      });
    }

    lines.push("Doporučení: prioritizuj otevřené kategorie s nízkým počtem nabídek a blížícím se termínem.");

    return { reply: lines.join("\n") };
  },
};
