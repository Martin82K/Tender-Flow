import type { AgentSkill } from "@features/agent/skills/types";
import { formatCurrency, getActiveProjectContext, keywordScore } from "@features/agent/skills/runtimeHelpers";

const keywords = [
  "briefing",
  "shrnuti projektu",
  "shrnuti projektu",
  "stav projektu",
  "prehled projektu",
  "přehled projektu",
  "co je noveho na projektu",
  "co je nového na projektu",
];

export const projectBriefingSkill: AgentSkill = {
  manifest: {
    id: "project-briefing",
    name: "Projektový briefing",
    description: "Rychlé shrnutí aktivního projektu včetně financí a postupu.",
    keywords,
    risk: "read",
    requiresProject: true,
  },
  match: (input) => {
    const baseScore = keywordScore(input.userMessage, keywords);
    const hasProject = !!getActiveProjectContext(input.runtime);

    if (!hasProject) return Math.max(0, baseScore - 0.2);
    return Math.min(1, baseScore + 0.25);
  },
  run: (input) => {
    const active = getActiveProjectContext(input.runtime);

    if (!active) {
      return {
        reply:
          "Nemám aktivní projekt. Otevři prosím konkrétní stavbu a napiš znovu třeba: vytvoř briefing projektu.",
      };
    }

    const { project, details } = active;
    const categories = details.categories ?? [];
    const sodCount = categories.filter((item) => item.status === "sod" || item.status === "closed").length;
    const plannedSum = categories.reduce((acc, item) => acc + (item.planBudget || 0), 0);
    const investorSum = categories.reduce((acc, item) => acc + (item.sodBudget || 0), 0);
    const delta = investorSum - plannedSum;

    const summary = [
      `Briefing projektu ${project.name}`,
      `- Lokalita: ${project.location || "neuvedeno"}`,
      `- Fáze: ${project.status}`,
      `- Kategorie: ${categories.length} celkem, ${sodCount} uzavřeno`,
      `- Interní plán: ${formatCurrency(plannedSum)}`,
      `- SOD vůči investorovi: ${formatCurrency(investorSum)}`,
      `- Rozdíl investor vs plán: ${formatCurrency(delta)}`,
    ];

    if (details.finishDate) {
      summary.push(`- Plánovaný konec: ${details.finishDate}`);
    }

    summary.push("Doporučení: zkontroluj 3 největší otevřené položky v pipeline a termíny jejich uzavření.");

    return { reply: summary.join("\n") };
  },
};
