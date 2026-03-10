import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import type { VoiceInteractionMode } from "@shared/types/voice";
import { AgentFloatingPanel } from "@shared/ui/agent/AgentFloatingPanel";

vi.mock("@/assets/viki.png", () => ({
  default: "viki.png",
}));

const hookState = vi.hoisted(() => ({
  useAgentController: vi.fn(),
}));

vi.mock("@app/agent/useAgentController", () => ({
  useAgentController: (...args: unknown[]) => hookState.useAgentController(...args),
}));

const featureState = vi.hoisted(() => ({
  hasFeature: vi.fn(),
  isLoading: false,
}));

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    hasFeature: featureState.hasFeature,
    isLoading: featureState.isLoading,
  }),
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

describe("AgentFloatingPanel", () => {
  const createControllerState = (
    mode: VoiceInteractionMode = "push_to_talk",
    assistantContent = "Ahoj",
  ) => ({
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
        source: "skill",
      },
    ],
    pendingActions: [],
    isLoading: false,
    defaultModel: { provider: "openrouter", model: "x-ai/grok-4.1-fast" },
    audience: "internal",
    contextScopes: ["project"],
    contextPolicyVersion: "v1-strict-allowlist",
    selectedProvider: "openrouter",
    selectedModel: "x-ai/grok-4.1-fast",
    availableModels: [{ id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", provider: "openrouter" }],
    isModelListLoading: false,
    voiceCaptureState: "idle",
    voiceCostMode: "economy",
    voiceInteractionMode: mode,
    voiceStyle: "nova",
    voiceOutputEnabled: mode === "push_to_talk_auto_voice",
    latestBudget: null,
    lastVoiceWarning: null,
    setSelectedProvider: vi.fn(),
    setSelectedModel: vi.fn(),
    setAudience: vi.fn(),
    toggleContextScope: vi.fn(),
    setVoiceOutputEnabled: vi.fn(),
    setVoiceCostMode: vi.fn(),
    setVoiceInteractionMode: vi.fn(),
    setVoiceStyle: vi.fn(),
    sendUserMessage: vi.fn(),
    confirmPendingAction: vi.fn(),
    dismissPendingAction: vi.fn(),
    startVoiceCapture: vi.fn(),
    stopVoiceCapture: vi.fn(),
    playVoiceReply: vi.fn(),
  });

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    hookState.useAgentController.mockReturnValue(createControllerState("push_to_talk"));
    featureState.isLoading = false;
    featureState.hasFeature.mockReturnValue(true);
  });

  it("skryje panel kdyz ai_viki neni pro uzivatele povolena", () => {
    featureState.hasFeature.mockReturnValue(false);

    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    expect(screen.queryByRole("button", { name: "Otevřít Viki" })).not.toBeInTheDocument();
  });

  it("zobrazi avatar Viki, otevíra nastaveni a neobsahuje text Glass režim", () => {
    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));

    expect(screen.getByRole("img", { name: "Viki avatar" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Profil Viki" })).toBeInTheDocument();
    expect(screen.queryByText(/Glass režim/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Audience režim")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Otevřít nastavení Viki" }));
    expect(screen.getByText("Audience režim")).toBeInTheDocument();
    expect(screen.getByLabelText("Hlasový režim")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nastavení Viki" })).toBeInTheDocument();
  });

  it("renderuje markdown v odpovedi asistentky a sanitizuje nebezpecny obsah", () => {
    hookState.useAgentController.mockReturnValue(
      createControllerState(
        "push_to_talk",
        "### Detailní briefing projektu\n\n**Důležité**\n\n```ts\nconst x = 1;\n```\n\n<script>alert(1)</script>",
      ),
    );

    const { container } = render(<AgentFloatingPanel runtime={runtimeFixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));

    const heading = container.querySelector(".viki-markdown h3");
    const strong = container.querySelector(".viki-markdown strong");
    const code = container.querySelector(".viki-markdown pre code");
    const script = container.querySelector(".viki-markdown script");

    expect(heading).toBeTruthy();
    expect(heading?.textContent).toContain("Detailní briefing projektu");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("Důležité");
    expect(code?.textContent).toContain("const x = 1;");
    expect(script).toBeNull();
  });

  it("v režimu text_only schova hlasove ovladani", () => {
    hookState.useAgentController.mockReturnValue(createControllerState("text_only"));
    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));
    fireEvent.click(screen.getByRole("button", { name: "Otevřít nastavení Viki" }));

    expect(screen.queryByRole("button", { name: "Podrž a mluv" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Přečíst" })).not.toBeInTheDocument();
  });

  it("v režimu push_to_talk zobrazi tlacitko Podrž a mluv", () => {
    hookState.useAgentController.mockReturnValue(createControllerState("push_to_talk"));
    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));
    fireEvent.click(screen.getByRole("button", { name: "Otevřít nastavení Viki" }));

    expect(screen.getByRole("button", { name: /Podrž a mluv/i })).toBeInTheDocument();
  });

  it("v režimu push_to_talk_auto_voice je hlasova odpoved zapnuta", () => {
    hookState.useAgentController.mockReturnValue(createControllerState("push_to_talk_auto_voice"));
    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));
    fireEvent.click(screen.getByRole("button", { name: "Otevřít nastavení Viki" }));

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it("umozni zmenit hlas Viki v nastaveni", () => {
    const state = createControllerState("push_to_talk");
    hookState.useAgentController.mockReturnValue(state);
    render(<AgentFloatingPanel runtime={runtimeFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Otevřít Viki" }));
    fireEvent.click(screen.getByRole("button", { name: "Otevřít nastavení Viki" }));

    fireEvent.change(screen.getByLabelText("Hlas Viki"), {
      target: { value: "shimmer" },
    });

    expect(state.setVoiceStyle).toHaveBeenCalledWith("shimmer");
  });
});
