import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: any[]) => Promise<unknown>>();
const netFetch = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
  },
  net: {
    fetch: netFetch,
  },
}));

const createResponse = (body: unknown = { success: true }) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  headers: new Headers({ "content-type": "application/json" }),
});

describe("public auth IPC handlers", () => {
  const sender = {} as Electron.WebContents;
  const event = { sender } as Electron.IpcMainInvokeEvent;
  const getSupabasePublicConfig = vi.fn(() => ({
    url: "https://example.supabase.co",
    anonKey: "sb_publishable_test-key",
  }));
  const isTrustedSender = vi.fn(() => true);

  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    vi.resetModules();
    getSupabasePublicConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "sb_publishable_test-key",
    });
    isTrustedSender.mockReturnValue(true);
    netFetch.mockResolvedValue(createResponse());

    const { registerPublicAuthHandlers } = await import(
      "../desktop/main/ipc/modules/publicAuthHandlers"
    );
    registerPublicAuthHandlers({ getSupabasePublicConfig, isTrustedSender });
  });

  it("umožní nepřihlášenému důvěryhodnému rendereru vyžádat reset hesla", async () => {
    const result = await handlers.get("auth:invokePublicFunction")?.(
      event,
      "request-password-reset",
      { email: "user@example.com" },
    );

    expect(isTrustedSender).toHaveBeenCalledWith(sender);
    expect(netFetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/request-password-reset",
      {
        method: "POST",
        headers: {
          apikey: "sb_publishable_test-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.com" }),
      },
    );
    expect(result).toMatchObject({ ok: true, status: 200 });
  });

  it("odmítne jinou Edge Function a neprovede síťový požadavek", async () => {
    await expect(
      handlers.get("auth:invokePublicFunction")?.(event, "ai-proxy", {}),
    ).rejects.toThrow("not allowed");
    expect(netFetch).not.toHaveBeenCalled();
  });

  it("odmítne nedůvěryhodný renderer", async () => {
    isTrustedSender.mockReturnValue(false);

    await expect(
      handlers.get("auth:invokePublicFunction")?.(
        event,
        "confirm-password-reset",
        { token: "token", password: "password" },
      ),
    ).rejects.toThrow("untrusted sender");
    expect(netFetch).not.toHaveBeenCalled();
  });

  it("odmítne nadlimitní payload", async () => {
    await expect(
      handlers.get("auth:invokePublicFunction")?.(
        event,
        "confirm-password-reset",
        { password: "x".repeat(17 * 1024) },
      ),
    ).rejects.toThrow("body is too large");
    expect(netFetch).not.toHaveBeenCalled();
  });

  it("povolí HTTP pouze pro lokální Supabase vývoj", async () => {
    getSupabasePublicConfig.mockReturnValue({
      url: "http://localhost:54321",
      anonKey: "anon-key",
    });

    await handlers.get("auth:invokePublicFunction")?.(
      event,
      "request-password-reset",
      { email: "user@example.com" },
    );

    expect(netFetch).toHaveBeenCalledWith(
      "http://localhost:54321/functions/v1/request-password-reset",
      expect.any(Object),
    );

    getSupabasePublicConfig.mockReturnValue({
      url: "http://supabase.example.com",
      anonKey: "anon-key",
    });
    await expect(
      handlers.get("auth:invokePublicFunction")?.(
        event,
        "request-password-reset",
        { email: "user@example.com" },
      ),
    ).rejects.toThrow("Invalid Supabase URL protocol");
  });
});
