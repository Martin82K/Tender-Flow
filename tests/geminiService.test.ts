import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: mockState.invokeAuthedFunction,
}));

describe("geminiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("při chybě loguje jen sanitizované shrnutí", async () => {
    mockState.invokeAuthedFunction.mockRejectedValue(
      new Error("token Bearer abc.def.ghi user john@example.com"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { getAiSuggestion } = await import("../services/geminiService");
    await expect(getAiSuggestion("test")).resolves.toBe("AI service temporarily unavailable.");

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).toContain("[redacted-email]");
    expect(serializedCalls).toContain("[redacted-token]");
    expect(serializedCalls).not.toContain("john@example.com");
    expect(serializedCalls).not.toContain("abc.def.ghi");

    errorSpy.mockRestore();
  });

  it("při nevalidním JSON neloguje celou AI odpověď", async () => {
    mockState.invokeAuthedFunction.mockResolvedValue({
      text: "john@example.com Bearer abc.def.ghi invalid json",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { findCompanyRegions } = await import("../services/geminiService");
    await expect(findCompanyRegions([{ id: "1", company: "Firma", ico: "123" }])).resolves.toEqual({});

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).not.toContain("john@example.com");
    expect(serializedCalls).not.toContain("abc.def.ghi");
    expect(serializedCalls).toContain("preview");

    errorSpy.mockRestore();
  });
});
