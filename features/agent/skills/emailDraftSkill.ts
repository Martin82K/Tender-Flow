import type { AgentSkill } from "@features/agent/skills/types";
import { getActiveProjectContext, keywordScore } from "@features/agent/skills/runtimeHelpers";

const keywords = [
  "navrh emailu",
  "návrh emailu",
  "napiš email",
  "odepis email",
  "odepiš email",
  "priprav email",
  "připrav email",
  "draft email",
  "email",
];

export const emailDraftSkill: AgentSkill = {
  manifest: {
    id: "email-draft",
    name: "Návrh emailu",
    description: "Vytvoří draft emailu pro dodavatele nebo interní tým.",
    keywords,
    risk: "read",
  },
  match: (input) => {
    const baseScore = keywordScore(input.userMessage, keywords);
    const hasProject = !!getActiveProjectContext(input.runtime);

    return hasProject ? Math.min(1, baseScore + 0.1) : baseScore;
  },
  run: (input) => {
    const active = getActiveProjectContext(input.runtime);
    const projectName = active?.project.name || "aktuální projekt";

    return {
      reply: [
        "Návrh emailu:",
        "",
        `Předmět: ${projectName} - doplnění nabídky`,
        "",
        "Dobrý den,",
        "",
        `děkujeme za spolupráci na projektu ${projectName}. Prosíme o doplnění/aktualizaci nabídky včetně termínu realizace a potvrzení kapacit.`,
        "",
        "Pokud potřebujete upřesnit zadání, dejte nám prosím vědět obratem.",
        "",
        "Děkujeme a přejeme hezký den.",
      ].join("\n"),
    };
  },
};
