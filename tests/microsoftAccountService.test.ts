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

import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";

describe("microsoftAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSupabaseFlow.mockResolvedValue(null);
    mocks.invoke.mockResolvedValue({ connected: false });
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
});
