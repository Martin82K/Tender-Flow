import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConversationMessage, AgentRuntimeSnapshot } from "@shared/types/agent";

const invokeAuthedFunctionMock = vi.fn();

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: (...args: unknown[]) => invokeAuthedFunctionMock(...args),
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              ai_extraction_provider: "openai",
              ai_extraction_model: "gpt-5-mini",
            },
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@app/agent/memoryStore", () => ({
  loadProjectMemory: vi.fn().mockResolvedValue(null),
}));

import { sendAgentFallbackMessage } from "@app/agent/llmGateway";

const runtimeFixture: AgentRuntimeSnapshot = {
  pathname: "/app",
  search: "",
  currentView: "dashboard",
  selectedProjectId: "p-1",
  projects: [],
  projectDetails: {},
  contacts: [],
  audience: "internal",
  contextScopes: ["project"],
  contextPolicyVersion: "v1-strict-allowlist",
  isAdmin: true,
  organizationId: "org-1",
  userId: "u-1",
  sessionRiskLevel: "low",
};

const conversationFixture: AgentConversationMessage[] = [
  {
    id: "m-1",
    role: "user",
    content: "zmen status projektu",
    createdAt: new Date().toISOString(),
  },
];

describe("llmGateway ai-agent", () => {
  beforeEach(() => {
    invokeAuthedFunctionMock.mockReset();
    invokeAuthedFunctionMock.mockResolvedValue({
      reply: "Pripravila jsem navrh akce.",
      source: "tool",
      usedModel: {
        provider: "openai",
        model: "gpt-5-mini",
        source: "override",
      },
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
      guard: {
        triggered: false,
      },
    });
  });

  it("preda ai-agent metadata do fallback odpovedi", async () => {
    const response = await sendAgentFallbackMessage({
      runtime: runtimeFixture,
      conversation: conversationFixture,
      modelSelection: {
        provider: "openai",
        model: "gpt-5-mini",
        source: "override",
      },
    });

    expect(invokeAuthedFunctionMock).toHaveBeenCalledTimes(1);
    expect(response.source).toBe("tool");
    expect(response.pendingAction?.policyDecision).toBe("require_confirmation");
    expect(response.toolExecutions[0]?.tool).toBe("queue_status_update");
    expect(response.traceId).toBe("trace-1");
  });
});
