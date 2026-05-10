import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeAuthedFunction = vi.fn();

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction,
}));

describe("createRealtimeVoiceSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("volá edge funkci realtime-session-create s kontextem projektu", async () => {
    invokeAuthedFunction.mockResolvedValue({
      clientSecret: "ek_test",
      expiresAt: "2026-05-09T12:00:00.000Z",
      sessionId: "session-1",
      model: "gpt-realtime-2",
    });

    const { createRealtimeVoiceSession } = await import(
      "@/features/voice-assistant/api/realtimeSession"
    );

    await expect(
      createRealtimeVoiceSession({
        currentProjectId: "project-1",
        currentView: "project",
        realtimeModel: "gpt-realtime-2",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        model: "gpt-realtime-2",
      }),
    );

    expect(invokeAuthedFunction).toHaveBeenCalledWith("realtime-session-create", {
      body: {
        currentProjectId: "project-1",
        currentView: "project",
        realtimeModel: "gpt-realtime-2",
      },
      timeoutMs: 15_000,
    });
  });

  it("umí požádat o starší standardní realtime model", async () => {
    invokeAuthedFunction.mockResolvedValue({
      clientSecret: "ek_test",
      expiresAt: "2026-05-09T12:00:00.000Z",
      sessionId: "session-1",
      model: "gpt-realtime",
    });

    const { createRealtimeVoiceSession } = await import(
      "@/features/voice-assistant/api/realtimeSession"
    );

    await expect(
      createRealtimeVoiceSession({
        currentProjectId: null,
        currentView: "command-center",
        realtimeModel: "gpt-realtime",
      }),
    ).resolves.toEqual(expect.objectContaining({ model: "gpt-realtime" }));

    expect(invokeAuthedFunction).toHaveBeenCalledWith("realtime-session-create", {
      body: {
        currentProjectId: null,
        currentView: "command-center",
        realtimeModel: "gpt-realtime",
      },
      timeoutMs: 15_000,
    });
  });

  it("odmítne běžný OpenAI API key místo ephemeral tokenu", async () => {
    invokeAuthedFunction.mockResolvedValue({
      clientSecret: "sk-live-secret",
      expiresAt: "2026-05-09T12:00:00.000Z",
      sessionId: "session-1",
      model: "gpt-realtime-2",
    });

    const { createRealtimeVoiceSession } = await import(
      "@/features/voice-assistant/api/realtimeSession"
    );

    await expect(
      createRealtimeVoiceSession({
        currentProjectId: null,
        currentView: "command-center",
        realtimeModel: "gpt-realtime-2",
      }),
    ).rejects.toThrow(/neplatný realtime token/i);
  });

  it("odmítne session vytvořenou pro jiný realtime model s diagnostikou", async () => {
    invokeAuthedFunction.mockResolvedValue({
      clientSecret: "ek_test",
      expiresAt: "2026-05-09T12:00:00.000Z",
      sessionId: "session-1",
      model: "gpt-realtime",
    });

    const { createRealtimeVoiceSession } = await import(
      "@/features/voice-assistant/api/realtimeSession"
    );

    await expect(
      createRealtimeVoiceSession({
        currentProjectId: null,
        currentView: "command-center",
        realtimeModel: "gpt-realtime-2",
      }),
    ).rejects.toThrow(/gpt-realtime.*gpt-realtime-2/i);
  });
});
