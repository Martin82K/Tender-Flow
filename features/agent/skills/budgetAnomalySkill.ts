import type { AgentSkill } from "@features/agent/skills/types";
import { formatCurrency, getActiveProjectContext, keywordScore } from "@features/agent/skills/runtimeHelpers";

const keywords = [
  "rozpocet",
  "rozpočet",
  "odchylka",
  "anomalie",
  "precerpani",
  "překročení",
  "bilance",
  "naklady",
  "náklady",
];

export const budgetAnomalySkill: AgentSkill = {
  manifest: {
    id: "budget-anomaly-check",
    name: "Analýza rozpočtu",
    description: "Najde největší odchylky mezi interním plánem a SOD položkami.",
    keywords,
    risk: "read",
    requiresProject: true,
  },
  match: (input) => {
    const baseScore = keywordScore(input.userMessage, keywords);
    const hasProject = !!getActiveProjectContext(input.runtime);

    if (!hasProject) return Math.max(0, baseScore - 0.2);
    return Math.min(1, baseScore + 0.2);
  },
  run: (input) => {
    const active = getActiveProjectContext(input.runtime);

    if (!active) {
      return {
        reply:
          "Pro analýzu rozpočtu potřebuji aktivní projekt. Otevři stavbu a napiš třeba: analyzuj odchylky rozpočtu.",
      };
    }

    const { project, details } = active;
    const categories = details.categories ?? [];

    if (categories.length === 0) {
      return {
        reply: `Projekt ${project.name} zatím nemá žádné kategorie, není co analyzovat.`,
      };
    }

    const diffs = categories
      .map((item) => ({
        title: item.title,
        plan: item.planBudget || 0,
        sod: item.sodBudget || 0,
        diff: (item.sodBudget || 0) - (item.planBudget || 0),
      }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const top = diffs.slice(0, 3);
    const overruns = diffs.filter((item) => item.diff < 0);
    const positive = diffs.filter((item) => item.diff > 0);

    const lines = [
      `Analýza odchylek rozpočtu pro projekt ${project.name}`,
      `- Kategorie s negativní odchylkou: ${overruns.length}`,
      `- Kategorie s pozitivní odchylkou: ${positive.length}`,
      "- Největší odchylky:",
    ];

    top.forEach((item, index) => {
      const sign = item.diff >= 0 ? "+" : "-";
      lines.push(
        `  ${index + 1}. ${item.title}: plán ${formatCurrency(item.plan)}, SOD ${formatCurrency(item.sod)}, rozdíl ${sign}${formatCurrency(Math.abs(item.diff))}`,
      );
    });

    lines.push(
      "Doporučení: u negativních odchylek ověř důvod (slepé položky, změny rozsahu, podceněné náklady) a připrav korekční plán.",
    );

    return { reply: lines.join("\n") };
  },
};
