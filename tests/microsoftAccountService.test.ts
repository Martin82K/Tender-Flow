import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openExternal: vi.fn(),
  startSupabaseFlow: vi.fn(),
  completeSupabaseFlow: vi.fn(),
  getUserIdentities: vi.fn(),
  linkIdentity: vi.fn(),
  unlinkIdentity: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/services/functionsClient", () => ({ invokeAuthedFunction: mocks.invoke }));
vi.mock("@/infra/platform/platformAdapter", () => ({
  shellAdapter: { openExternal: mocks.openExternal },
  oauthAdapter: {
    startSupabaseFlow: mocks.startSupabaseFlow,
    completeSupabaseFlow: mocks.completeSupabaseFlow,
  },
}));
vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getUserIdentities: mocks.getUserIdentities,
      linkIdentity: mocks.linkIdentity,
      unlinkIdentity: mocks.unlinkIdentity,
      signInWithOAuth: mocks.signInWithOAuth,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getSession: mocks.getSession,
    },
  },
}));

import {
  microsoftAccountService,
  microsoftLoginService,
} from "@/infra/auth/microsoftAccountService";

describe("microsoftAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSupabaseFlow.mockResolvedValue(null);
    mocks.invoke.mockResolvedValue({ connected: true });
    mocks.getUserIdentities.mockResolvedValue({ data: { identities: [] }, error: null });
  });

  it("čte globální stav bez projectId", async () => {
    await microsoftAccountService.getStatus();

    expect(mocks.invoke).toHaveBeenCalledWith("dochub-personal-microsoft", {
      body: { action: "status" },
      retries: 1,
    });
  });

  it("pro již propojenou identitu znovu použije správně nakonfigurovaný Supabase Azure provider", async () => {
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "azure" }] },
      error: null,
    });
    mocks.startSupabaseFlow.mockResolvedValue({ flowId: "flow-1", redirectTo: "http://127.0.0.1/callback" });
    mocks.completeSupabaseFlow.mockResolvedValue({ code: "supabase-code" });
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://vpvowigatikngnaflkyk.supabase.co/auth/v1/authorize?provider=azure" },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "provider-access",
          provider_refresh_token: "provider-refresh",
        },
      },
      error: null,
    });

    await microsoftAccountService.connectMicrosoftAccount();

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: "azure",
      options: expect.objectContaining({
        scopes: "email offline_access https://graph.microsoft.com/.default",
      }),
    }));
    expect(mocks.invoke).not.toHaveBeenCalledWith("dochub-auth-url", expect.anything());
    expect(mocks.invoke).toHaveBeenCalledWith("microsoft-graph-connection", {
      body: {
        action: "connect",
        accessToken: "provider-access",
        refreshToken: "provider-refresh",
      },
      retries: 0,
    });
  });

  it("při prvním propojení žádá všechny tenantem schválené Graph scope najednou", async () => {
    mocks.startSupabaseFlow.mockResolvedValue({ flowId: "flow-1", redirectTo: "http://127.0.0.1/callback" });
    mocks.completeSupabaseFlow.mockResolvedValue({ code: "supabase-code" });
    mocks.linkIdentity.mockResolvedValue({ data: { url: "https://login.microsoftonline.com/link" }, error: null });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "provider-access",
          provider_refresh_token: "provider-refresh",
        },
      },
      error: null,
    });

    await microsoftAccountService.connectMicrosoftAccount();

    expect(mocks.linkIdentity).toHaveBeenCalledWith(expect.objectContaining({
      provider: "azure",
      options: expect.objectContaining({
        scopes: "email offline_access https://graph.microsoft.com/.default",
      }),
    }));
  });

  it("po desktopovém PKCE exchange uloží provider token pouze přes autentizovanou Edge Function", async () => {
    mocks.startSupabaseFlow.mockResolvedValue({ flowId: "flow-1", redirectTo: "http://127.0.0.1/callback" });
    mocks.completeSupabaseFlow.mockResolvedValue({ code: "supabase-code" });
    mocks.linkIdentity.mockResolvedValue({ data: { url: "https://login.microsoftonline.com/link" }, error: null });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "provider-access",
          provider_refresh_token: "provider-refresh",
        },
      },
      error: null,
    });

    await microsoftAccountService.connectMicrosoftAccount();

    expect(mocks.invoke).toHaveBeenCalledWith("microsoft-graph-connection", {
      body: {
        action: "connect",
        accessToken: "provider-access",
        refreshToken: "provider-refresh",
      },
      retries: 0,
    });
  });

  it("nepovažuje Microsoft přihlášení za dokončené bez uloženého Graph refresh tokenu", async () => {
    mocks.startSupabaseFlow.mockResolvedValue({ flowId: "flow-1", redirectTo: "http://127.0.0.1/callback" });
    mocks.completeSupabaseFlow.mockResolvedValue({ code: "supabase-code" });
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://vpvowigatikngnaflkyk.supabase.co/auth/v1/authorize?provider=azure" },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "provider-access",
          provider_refresh_token: null,
        },
      },
      error: null,
    });

    await expect(microsoftLoginService.login("/app/projects")).rejects.toThrow(
      "Microsoft neposkytl token pro dlouhodobé propojení.",
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "microsoft-graph-connection",
      expect.anything(),
    );
  });

  it("po jednom Microsoft přihlášení uloží Graph grant a spustí první To Do synchronizaci", async () => {
    mocks.startSupabaseFlow.mockResolvedValue({ flowId: "flow-1", redirectTo: "http://127.0.0.1/callback" });
    mocks.completeSupabaseFlow.mockResolvedValue({ code: "supabase-code" });
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://vpvowigatikngnaflkyk.supabase.co/auth/v1/authorize?provider=azure" },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "provider-access",
          provider_refresh_token: "provider-refresh",
        },
      },
      error: null,
    });
    mocks.invoke
      .mockResolvedValueOnce({ connected: true })
      .mockResolvedValueOnce({ connected: true, pulled: 0, pushed: 0 });

    await microsoftLoginService.login("/app/projects");

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "microsoft-graph-connection", {
      body: {
        action: "connect",
        accessToken: "provider-access",
        refreshToken: "provider-refresh",
      },
      retries: 0,
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "microsoft-todo-sync", {
      body: {},
      retries: 1,
      timeoutMs: 90_000,
    });
  });

  it("pro webový návrat zachová cílovou cestu a označí dokončení Graph propojení", async () => {
    mocks.startSupabaseFlow.mockResolvedValue(null);
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: new Error("stop before redirect"),
    });

    await expect(microsoftLoginService.login("/app/projects?view=mine")).rejects.toThrow(
      "stop before redirect",
    );

    const call = mocks.signInWithOAuth.mock.calls[0]?.[0];
    const redirectTo = new URL(call.options.redirectTo);
    expect(redirectTo.pathname).toBe("/app/projects");
    expect(redirectTo.searchParams.get("view")).toBe("mine");
    expect(redirectTo.searchParams.get("microsoft_provider")).toBe("connected");
  });
});
