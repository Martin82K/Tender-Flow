import { describe, expect, it } from "vitest";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import { deepProjectBriefingSkill } from "@features/agent/skills/deepProjectBriefingSkill";

const buildRuntime = (
  selectedProjectId: string | null = "p-42",
  audience: AgentRuntimeSnapshot["audience"] = "internal",
): AgentRuntimeSnapshot => ({
  pathname: "/app/project/p-42",
  search: "?tab=overview",
  currentView: "project",
  activeProjectTab: "overview",
  selectedProjectId,
  projects: [
    {
      id: "p-42",
      name: "REKO Bazén Aš",
      location: "Aš",
      status: "realization",
    },
  ],
  projectDetails: {
    "p-42": {
      id: "p-42",
      title: "REKO Bazén Aš",
      location: "Aš",
      finishDate: "2026-06-30",
      siteManager: "Ing. Antonín Černý",
      investor: "Město Aš",
      plannedCost: 133571151,
      categories: [
        {
          id: "c1",
          title: "AL výplně otvorů",
          budget: "6 822 820 Kč",
          planBudget: 6822820,
          sodBudget: 6403841,
          status: "sod",
          subcontractorCount: 1,
          description: "Fasádní systémy",
          deadline: "2026-03-12",
          realizationStart: "2026-03-20",
          realizationEnd: "2026-05-30",
        },
        {
          id: "c2",
          title: "Bourací práce",
          budget: "5 483 305 Kč",
          planBudget: 5483305,
          sodBudget: 6753900,
          status: "open",
          subcontractorCount: 0,
          description: "Demolice a příprava",
          deadline: "2026-03-10",
          realizationStart: "2026-03-15",
          realizationEnd: "2026-04-15",
        },
      ],
      investorFinancials: {
        sodPrice: 129799817,
        amendments: [
          { id: "a1", label: "Dodatek č.1", price: 36747752 },
        ],
      },
      bids: {
        c1: [
          {
            id: "b1",
            subcontractorId: "s1",
            companyName: "ALFA a.s.",
            contactPerson: "Novák",
            status: "offer",
            selectionRound: 1,
          },
        ],
        c2: [
          {
            id: "b2",
            subcontractorId: "s2",
            companyName: "BETA s.r.o.",
            contactPerson: "Dvořák",
            status: "sent",
            selectionRound: 0,
          },
          {
            id: "b3",
            subcontractorId: "s2",
            companyName: "BETA s.r.o.",
            contactPerson: "Dvořák",
            status: "offer",
            selectionRound: 1,
          },
        ],
      },
    },
  },
  contacts: [
    {
      id: "s1",
      company: "ALFA a.s.",
      specialization: ["Stavební práce"],
      contacts: [{ id: "p1", name: "Novák", phone: "+420123", email: "n@example.com" }],
      status: "available",
    },
  ],
  audience,
  contextScopes: ["project", "pipeline", "contacts", "memory", "manual"],
  contextPolicyVersion: "v1-strict-allowlist",
  organizationId: "org-1",
  userId: "u-1",
  isAdmin: true,
});

describe("deepProjectBriefingSkill", () => {
  it("silne matchuje detailni reporting dotaz", () => {
    const score = deepProjectBriefingSkill.match({
      userMessage: "Prosím detailní report projektu včetně KPI a rizik",
      runtime: buildRuntime(),
      conversation: [],
    });

    expect(score).toBeGreaterThanOrEqual(0.45);
  });

  it("matchuje i obecny pozadavek na detailnejsi vystup", () => {
    const score = deepProjectBriefingSkill.match({
      userMessage: "chtěl bych ale něco detailnějšího",
      runtime: buildRuntime(),
      conversation: [],
    });

    expect(score).toBeGreaterThanOrEqual(0.45);
  });

  it("vytvori detailni markdown report s tabulkami a grafy", async () => {
    const result = await deepProjectBriefingSkill.run({
      userMessage: "udělej detailní briefing projektu",
      runtime: buildRuntime(),
      conversation: [],
    });

    expect(result.reply).toContain("## Detailní report projektu REKO Bazén Aš");
    expect(result.reply).toContain("### KPI přehled");
    expect(result.reply).toContain("### Grafy (ASCII)");
    expect(result.reply).toContain("| Kategorie | Stav | Deadline |");
    expect(result.reply).toContain("### Rizika");
    expect(result.reply).toContain("### Datová stopa reportu");
    expect(result.reply).toContain("Město Aš");
  });

  it("v klientskem rezimu nevraci interni plan a planovany naklad", async () => {
    const result = await deepProjectBriefingSkill.run({
      userMessage: "udělej detailní briefing projektu",
      runtime: buildRuntime("p-42", "client"),
      conversation: [],
    });

    expect(result.reply).toContain("Hrubá odchylka interního plánu není v klientském režimu dostupná.");
    expect(result.reply).not.toContain("Interní plán kategorií");
    expect(result.reply).not.toContain("Interní plánovaný náklad projektu");
    expect(result.reply).not.toContain("Součet odchylek kategorií");
  });

  it("bez aktivniho projektu vraci bezpecnou hlasku", async () => {
    const result = await deepProjectBriefingSkill.run({
      userMessage: "detailní report projektu",
      runtime: buildRuntime(null),
      conversation: [],
    });

    expect(result.reply).toContain("potřebuji aktivní projekt");
  });
});
