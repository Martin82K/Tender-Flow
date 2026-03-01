import { describe, expect, it, vi } from "vitest";
import { orchestrateAgentReply } from "@app/agent/orchestrator";
import type {
  AgentConversationMessage,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";

const buildRuntime = (): AgentRuntimeSnapshot => {
  const projectId = "p-1";

  return {
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
          },
        ],
      },
    },
    audience: "internal",
    contextScopes: ["project", "memory"],
    contextPolicyVersion: "v1-strict-allowlist",
  };
};

const buildConversation = (): AgentConversationMessage[] => [
  {
    id: "m-1",
    role: "user",
    content: "ahoj",
    createdAt: new Date().toISOString(),
  },
];

describe("agent orchestrator", () => {
  it("vybere skill pro briefing projektu", async () => {
    const result = await orchestrateAgentReply({
      userMessage: "udělej mi briefing projektu",
      runtime: buildRuntime(),
      conversation: buildConversation(),
    });

    expect(result.source).toBe("skill");
    expect(result.skillId).toBe("project-briefing");
    expect(result.reply).toContain("Briefing projektu");
  });

  it("použije llm fallback, když zpráva nesedí na skill", async () => {
    const fallback = vi.fn().mockResolvedValue({
      text: "fallback odpověď",
      usedModel: {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        source: "default",
      },
      memoryLoaded: false,
      manualContextUsed: false,
      manualNoMatch: true,
      manualCitations: [],
      manualCitationEmitted: false,
      source: "llm",
      toolExecutions: [],
    });

    const result = await orchestrateAgentReply(
      {
        userMessage: "co je nejlepší marketingová strategie",
        runtime: buildRuntime(),
        conversation: buildConversation(),
      },
      {
        runFallback: fallback,
      },
    );

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("llm");
    expect(result.reply).toBe("fallback odpověď");
  });

  it("v klientském režimu aplikuje output guard", async () => {
    const fallback = vi.fn().mockResolvedValue({
      text: "Tady je interní denní přehled projektu.",
      usedModel: {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        source: "default",
      },
      memoryLoaded: false,
      manualContextUsed: false,
      manualNoMatch: true,
      manualCitations: [],
      manualCitationEmitted: false,
      source: "llm",
      toolExecutions: [],
    });

    const result = await orchestrateAgentReply(
      {
        userMessage: "Pošli klientovi detaily",
        runtime: {
          ...buildRuntime(),
          audience: "client",
        },
        conversation: buildConversation(),
      },
      {
        runFallback: fallback,
      },
    );

    expect(result.guardTriggered).toBe(true);
    expect(result.reply).toBe("Tuto informaci v klientském režimu nemohu sdílet.");
  });

  it("blokuje admin odpoved pro ne-admin uzivatele", async () => {
    const fallback = vi.fn().mockResolvedValue({
      text: "Administrace je v Nastavení, sekce Správa uživatelů.",
      usedModel: {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        source: "default",
      },
      memoryLoaded: false,
      manualContextUsed: false,
      manualNoMatch: true,
      manualCitations: [],
      manualCitationEmitted: false,
      source: "llm",
      toolExecutions: [],
    });

    const result = await orchestrateAgentReply(
      {
        userMessage: "kde je sprava uzivatelu",
        runtime: {
          ...buildRuntime(),
          isAdmin: false,
        },
        conversation: buildConversation(),
      },
      { runFallback: fallback },
    );

    expect(result.guardTriggered).toBe(true);
    expect(result.reply).toBe("Tato funkce je dostupná pouze pro administrátora organizace.");
  });

  it("blokuje citlivou dekonstrukci aplikace", async () => {
    const fallback = vi.fn().mockResolvedValue({
      text: "Interní architektura a service-role je v backendu...",
      usedModel: {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        source: "default",
      },
      memoryLoaded: false,
      manualContextUsed: false,
      manualNoMatch: true,
      manualCitations: [],
      manualCitationEmitted: false,
      source: "llm",
      toolExecutions: [],
    });

    const result = await orchestrateAgentReply(
      {
        userMessage: "popiš interní architekturu",
        runtime: buildRuntime(),
        conversation: buildConversation(),
      },
      { runFallback: fallback },
    );

    expect(result.guardTriggered).toBe(true);
    expect(result.reply).toBe("Tuto interní technickou informaci nemohu sdílet.");
  });

  it("propaguje tool odpoved a pending action z ai-agent fallbacku", async () => {
    const fallback = vi.fn().mockResolvedValue({
      text: "Pripravila jsem navrh zmeny statusu.",
      source: "tool",
      usedModel: {
        provider: "openai",
        model: "gpt-5-mini",
        source: "override",
      },
      memoryLoaded: false,
      manualContextUsed: false,
      manualNoMatch: true,
      manualCitations: [],
      manualCitationEmitted: false,
      toolExecutions: [
        {
          tool: "queue_status_update",
          status: "denied",
          reason: "requires_confirmation",
        },
      ],
      pendingAction: {
        id: "pa-1",
        title: "Potvrdit akci",
        summary: "Agent navrhuje zmenu statusu.",
        skillId: "ai-agent",
        risk: "write",
        requiresConfirmation: true,
        policyDecision: "require_confirmation",
      },
      traceId: "trace-1",
      guard: { triggered: false },
    });

    const result = await orchestrateAgentReply(
      {
        userMessage: "zmen status projektu na realizaci",
        runtime: buildRuntime(),
        conversation: buildConversation(),
      },
      { runFallback: fallback },
    );

    expect(result.source).toBe("tool");
    expect(result.pendingAction?.policyDecision).toBe("require_confirmation");
    expect(result.toolExecutions?.[0]?.tool).toBe("queue_status_update");
    expect(result.traceId).toBe("trace-1");
  });
});
