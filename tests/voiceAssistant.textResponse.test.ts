import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeAuthedFunction = vi.fn();

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction,
}));

describe("createTextAssistantResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("volá samostatný textový endpoint Viky", async () => {
    invokeAuthedFunction.mockResolvedValue({
      kind: "message",
      responseId: "resp-1",
      model: "gpt-5-mini",
      text: "Vyhrála Alfa Stav.",
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    const { createTextAssistantResponse } = await import(
      "@/features/voice-assistant/api/textResponse"
    );

    await expect(
      createTextAssistantResponse({
        input: "Kdo vyhrál elektro?",
        messages: [],
        currentProjectId: "project-1",
        currentView: "project",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        model: "gpt-5-mini",
        text: "Vyhrála Alfa Stav.",
      }),
    );

    expect(invokeAuthedFunction).toHaveBeenCalledWith("viky-text-response", {
      body: {
        input: "Kdo vyhrál elektro?",
        messages: [],
        currentProjectId: "project-1",
        currentView: "project",
      },
      timeoutMs: 30_000,
    });
  });

  it("odmítne neočekávaný textový model", async () => {
    invokeAuthedFunction.mockResolvedValue({
      kind: "message",
      responseId: "resp-1",
      model: "gpt-realtime",
      text: "OK",
    });

    const { createTextAssistantResponse } = await import(
      "@/features/voice-assistant/api/textResponse"
    );

    await expect(
      createTextAssistantResponse({
        input: "test",
        messages: [],
        currentProjectId: null,
        currentView: "command-center",
      }),
    ).rejects.toThrow(/neočekávaný model/i);
  });
});
