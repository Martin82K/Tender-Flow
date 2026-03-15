import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  getSession: vi.fn(),
  logIncident: vi.fn().mockResolvedValue({ incidentId: "INC-1" }),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.getSession,
    },
  },
}));

vi.mock("../services/incidentLogger", () => ({
  logIncident: mockState.logIncident,
}));

describe("functionsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    mockState.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
        },
      },
    });
  });

  it("po vycerpani retry zaloguje selhani edge funkce", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeAuthedFunction } = await import("../services/functionsClient");

    await expect(
      invokeAuthedFunction("dochub-manage-folder", { retries: 1 }),
    ).rejects.toThrow(/network down/i);

    expect(mockState.logIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FUNCTION_INVOKE_FAILED",
        context: expect.objectContaining({
          action: "invoke_function",
          function_name: "dochub-manage-folder",
          action_status: "error",
        }),
      }),
    );
  });

  it("pri selhani fetch loguje jen sanitizovane detaily", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(
      new Error("Kontakt john@example.com authorization=Bearer abc.def.ghi"),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeAuthedFunction } = await import("../services/functionsClient");

    await expect(invokeAuthedFunction("send-email")).rejects.toThrow(/john@example.com/i);

    const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("send-email");
    expect(loggedPayload).toContain("[redacted-email]");
    expect(loggedPayload).toContain("[redacted-token]");
    expect(loggedPayload).not.toContain("john@example.com");
    expect(loggedPayload).not.toContain("abc.def.ghi");
  });

  it("pri uspesnem volani nevypisuje debug console.log", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { invokeAuthedFunction } = await import("../services/functionsClient");

    const result = await invokeAuthedFunction<{ success: boolean }>("send-email");

    expect(result).toEqual({ success: true });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
