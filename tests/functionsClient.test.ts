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
});
