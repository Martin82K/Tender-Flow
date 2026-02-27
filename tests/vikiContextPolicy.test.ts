import { describe, expect, it } from "vitest";
import { buildClientContext, buildInternalContext } from "@app/agent/contextSummary";
import { guardClientFacingOutput } from "@app/agent/contextPolicy";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import type { AgentProjectMemoryDocument } from "@shared/types/agentMemory";

const projectId = "p-1";

const runtimeBase: AgentRuntimeSnapshot = {
  pathname: "/app/project/p-1",
  search: "?tab=overview",
  currentView: "project",
  activeProjectTab: "overview",
  selectedProjectId: projectId,
  projects: [
    {
      id: projectId,
      name: "Bytový dům Brno",
      location: "Brno",
      status: "tender",
    },
  ],
  contacts: [],
  projectDetails: {
    [projectId]: {
      title: "Bytový dům Brno",
      location: "Brno",
      finishDate: "2026-12-31",
      siteManager: "Jan Novák",
      plannedCost: 123456789,
      categories: [
        {
          id: "c-1",
          title: "VZT",
          budget: "1 000 000 Kč",
          sodBudget: 1100000,
          planBudget: 1000000,
          status: "open",
          subcontractorCount: 5,
          description: "Vzduchotechnika",
          deadline: "2026-04-01",
        },
      ],
    },
  },
  audience: "internal",
  contextScopes: ["project", "memory"],
  contextPolicyVersion: "v1-strict-allowlist",
};

const memory: AgentProjectMemoryDocument = {
  meta: {
    projectId,
    updatedAt: "2026-02-27T00:00:00.000Z",
    updatedBy: "user-1",
    version: 1,
    sectionsVisibility: {
      "Interní poznámky": "internal",
      "Klientsky publikovatelné shrnutí": "public",
    },
  },
  sections: [
    {
      title: "Interní poznámky",
      visibility: "internal",
      content: "Toto je interní denní přehled.",
    },
    {
      title: "Klientsky publikovatelné shrnutí",
      visibility: "public",
      content: "Klientský update je připraven.",
    },
  ],
};

describe("viki context policy", () => {
  it("client context obsahuje jen allowlist + public memory", () => {
    const output = buildClientContext({
      runtime: {
        ...runtimeBase,
        audience: "client",
      },
      memory,
    });

    expect(output).toContain("CLIENT SAFE KONTEXT");
    expect(output).toContain("Klientský update je připraven.");
    expect(output).not.toContain("interní denní přehled");
    expect(output).not.toContain("123456789");
  });

  it("internal context obsahuje interní data i internal memory", () => {
    const output = buildInternalContext({
      runtime: runtimeBase,
      memory,
    });

    expect(output).toContain("Plánovaný náklad projektu");
    expect(output).toContain("Toto je interní denní přehled.");
  });

  it("guard blokuje interní fráze v klientské odpovědi", () => {
    const guarded = guardClientFacingOutput("Posílám interní denní přehled.");
    expect(guarded.blocked).toBe(true);
    expect(guarded.text).toBe("Tuto informaci v klientském režimu nemohu sdílet.");
  });
});
