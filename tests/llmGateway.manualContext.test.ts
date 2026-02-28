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
              ai_extraction_provider: "openrouter",
              ai_extraction_model: "anthropic/claude-3.5-sonnet",
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
  selectedProjectId: null,
  projects: [],
  projectDetails: {},
  contacts: [],
  audience: "internal",
  contextScopes: ["project", "manual"],
  contextPolicyVersion: "v1-strict-allowlist",
  isAdmin: false,
};

const conversationFixture: AgentConversationMessage[] = [
  {
    id: "m-1",
    role: "user",
    content: "kde najdu dashboard",
    createdAt: new Date().toISOString(),
  },
];

describe("llmGateway manual context", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    invokeAuthedFunctionMock.mockReset();
    invokeAuthedFunctionMock.mockResolvedValue({
      text: "Dashboard najdeš v levém sidebaru.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entries: [
            {
              slug: "navigace-v-aplikaci",
              title: "Navigace v aplikaci",
              content: "V levém panelu je Dashboard.",
              keywords: ["dashboard", "navigace"],
              source_anchor: "#navigace-v-aplikaci",
            },
          ],
        }),
      }),
    );
  });

  it("prida manual context do system promptu a vrati citaci", async () => {
    const response = await sendAgentFallbackMessage({
      runtime: runtimeFixture,
      conversation: conversationFixture,
      modelSelection: {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        source: "override",
      },
    });

    expect(invokeAuthedFunctionMock).toHaveBeenCalledTimes(1);
    const call = invokeAuthedFunctionMock.mock.calls[0];
    const payload = call[1] as { body: { history: Array<{ role: string; content: string }> } };
    expect(payload.body.history[0].content).toContain("MANUAL CONTEXT");
    expect(payload.body.history[0].content).toContain("#navigace-v-aplikaci");

    expect(response.text).toContain("Zdroj: Navigace v aplikaci (#navigace-v-aplikaci)");
    expect(response.manualContextUsed).toBe(true);
    expect(response.manualCitationEmitted).toBe(true);
  });
});
