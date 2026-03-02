import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import { useAgentController } from "@app/agent/useAgentController";

const mocks = vi.hoisted(() => ({
  getDefaultAgentModelSelection: vi.fn(),
  getProviderModels: vi.fn(),
}));

vi.mock("@app/agent/contextPolicy", () => ({
  AGENT_CONTEXT_POLICY_VERSION: "v1-strict-allowlist",
}));

vi.mock("@app/agent/llmGateway", () => ({
  getDefaultAgentModelSelection: (...args: unknown[]) => mocks.getDefaultAgentModelSelection(...args),
}));

vi.mock("@app/agent/modelCatalog", () => ({
  getProviderModels: (...args: unknown[]) => mocks.getProviderModels(...args),
}));

vi.mock("@app/agent/orchestrator", () => ({
  orchestrateAgentReply: vi.fn(),
}));

vi.mock("@app/agent/voiceGateway", () => ({
  base64ToObjectUrl: vi.fn(),
  synthesizeVoiceReply: vi.fn(),
  transcribeVoiceMessage: vi.fn(),
}));

vi.mock("@app/agent/usageTracking", () => ({
  trackVikiUsageEvent: vi.fn(),
}));

const runtimeFixture: AgentRuntimeSnapshot = {
  pathname: "/",
  search: "",
  currentView: "dashboard",
  selectedProjectId: null,
  projects: [],
  projectDetails: {},
  contacts: [],
  audience: "internal",
  contextScopes: ["project"],
  contextPolicyVersion: "v1-strict-allowlist",
};

describe("useAgentController voice interaction mode", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getDefaultAgentModelSelection.mockReset();
    mocks.getProviderModels.mockReset();

    mocks.getDefaultAgentModelSelection.mockResolvedValue({
      provider: "openrouter",
      model: "x-ai/grok-4.1-fast",
      source: "default",
    });
    mocks.getProviderModels.mockResolvedValue([
      {
        id: "x-ai/grok-4.1-fast",
        label: "Grok 4.1 Fast",
        provider: "openrouter",
        capabilities: ["chat"],
      },
    ]);
  });

  it("fallbackne legacy hodnotu na push_to_talk a persistuje ji", async () => {
    localStorage.setItem("viki:voiceInteractionMode", "legacy-mode");

    const { result } = renderHook(() => useAgentController(runtimeFixture));

    await waitFor(() => {
      expect(result.current.availableModels.length).toBeGreaterThan(0);
    });

    expect(result.current.voiceInteractionMode).toBe("push_to_talk");

    await waitFor(() => {
      expect(localStorage.getItem("viki:voiceInteractionMode")).toBe("push_to_talk");
    });
  });

  it("pri prepnuti na text_only vypne voiceOutputEnabled", async () => {
    localStorage.setItem("viki:voiceInteractionMode", "push_to_talk");
    localStorage.setItem("viki:voiceOutputEnabled", "true");

    const { result } = renderHook(() => useAgentController(runtimeFixture));

    await waitFor(() => {
      expect(result.current.availableModels.length).toBeGreaterThan(0);
    });
    expect(result.current.voiceOutputEnabled).toBe(true);

    act(() => {
      result.current.setVoiceInteractionMode("text_only");
    });

    await waitFor(() => {
      expect(result.current.voiceOutputEnabled).toBe(false);
      expect(localStorage.getItem("viki:voiceInteractionMode")).toBe("text_only");
    });
  });

  it("pri prepnuti na push_to_talk_auto_voice zapne voiceOutputEnabled", async () => {
    localStorage.setItem("viki:voiceInteractionMode", "push_to_talk");
    localStorage.setItem("viki:voiceOutputEnabled", "false");

    const { result } = renderHook(() => useAgentController(runtimeFixture));

    await waitFor(() => {
      expect(result.current.availableModels.length).toBeGreaterThan(0);
    });
    expect(result.current.voiceOutputEnabled).toBe(false);

    act(() => {
      result.current.setVoiceInteractionMode("push_to_talk_auto_voice");
    });

    await waitFor(() => {
      expect(result.current.voiceOutputEnabled).toBe(true);
      expect(localStorage.getItem("viki:voiceInteractionMode")).toBe("push_to_talk_auto_voice");
    });
  });

  it("persistuje vybrany hlas Viki", async () => {
    localStorage.setItem("viki:voiceStyle", "shimmer");

    const { result } = renderHook(() => useAgentController(runtimeFixture));

    await waitFor(() => {
      expect(result.current.availableModels.length).toBeGreaterThan(0);
    });
    expect(result.current.voiceStyle).toBe("shimmer");

    act(() => {
      result.current.setVoiceStyle("nova");
    });

    await waitFor(() => {
      expect(localStorage.getItem("viki:voiceStyle")).toBe("nova");
    });
  });
});
