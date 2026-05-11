import { describe, expect, it } from "vitest";
import { shouldEnableVoiceAssistantForRoute } from "@/features/voice-assistant/model/routeAvailability";

describe("shouldEnableVoiceAssistantForRoute", () => {
  it("vypne Viky v projektové pipeline", () => {
    expect(
      shouldEnableVoiceAssistantForRoute({
        currentView: "project",
        activeProjectTab: "pipeline",
      }),
    ).toBe(false);
  });

  it("ponechá Viky na ostatních projektových záložkách", () => {
    expect(
      shouldEnableVoiceAssistantForRoute({
        currentView: "project",
        activeProjectTab: "overview",
      }),
    ).toBe(true);
  });

  it("ponechá Viky mimo projektový pohled", () => {
    expect(
      shouldEnableVoiceAssistantForRoute({
        currentView: "command-center",
        activeProjectTab: "pipeline",
      }),
    ).toBe(true);
  });
});
