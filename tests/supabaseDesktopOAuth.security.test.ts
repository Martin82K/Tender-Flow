import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  openExternal: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: any[]) => any) => {
      electronMocks.handlers.set(channel, handler);
    },
  },
  shell: { openExternal: electronMocks.openExternal },
}));

import { registerOAuthHandlers } from "@/desktop/main/ipc/modules/oauthHandlers";

const sender = { id: 1 } as Electron.WebContents;
const otherSender = { id: 2 } as Electron.WebContents;

const register = (
  waitForCode: Promise<{ code: string; state: string | null }>,
  startLoopbackServer = vi.fn().mockResolvedValue({ port: 43123, waitForCode }),
) => {
  registerOAuthHandlers({
    parseUrl: (value) => new URL(value),
    isAllowedExternalUrl: () => true,
    createCodeVerifier: () => "verifier",
    createCodeChallenge: () => "challenge",
    startLoopbackServer,
    requireAuth: vi.fn(),
    isTrustedSender: () => true,
    getSupabaseUrl: () => "https://project.supabase.co",
  });
  return startLoopbackServer;
};

describe("desktop Supabase OAuth broker", () => {
  beforeEach(() => {
    electronMocks.handlers.clear();
    electronMocks.openExternal.mockReset().mockResolvedValue(undefined);
  });

  it("odmítne jiný origin, provider i návratovou adresu", async () => {
    register(new Promise(() => undefined));
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });

    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: `https://evil.example/auth/v1/authorize?provider=azure&redirect_to=${encodeURIComponent(flow.redirectTo)}`,
    })).rejects.toThrow("Blocked Supabase OAuth authorize URL");

    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: `https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(flow.redirectTo)}`,
    })).rejects.toThrow("Blocked Supabase OAuth authorize URL");

    expect(electronMocks.openExternal).not.toHaveBeenCalled();
  });

  it("otevře pouze přesnou Azure URL projektu a vrátí jednorázový kód", async () => {
    let resolveCode!: (value: { code: string; state: string | null }) => void;
    const waitForCode = new Promise<{ code: string; state: string | null }>((resolve) => {
      resolveCode = resolve;
    });
    register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL("https://project.supabase.co/auth/v1/authorize");
    authorizeUrl.searchParams.set("provider", "azure");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);
    authorizeUrl.searchParams.set("state", "expected-state");

    const completion = complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    });
    resolveCode({ code: "pkce-code", state: "expected-state" });
    await expect(completion).resolves.toEqual({ code: "pkce-code" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(authorizeUrl.toString());

    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    })).rejects.toThrow("OAuth flow not found or expired");
  });

  it("povolí přesnou Supabase cestu pro napárování identity", async () => {
    let resolveCode!: (value: { code: string; state: string | null }) => void;
    const waitForCode = new Promise<{ code: string; state: string | null }>((resolve) => {
      resolveCode = resolve;
    });
    register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL("https://project.supabase.co/auth/v1/user/identities/authorize");
    authorizeUrl.searchParams.set("provider", "azure");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);

    const completion = complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    });
    resolveCode({ code: "identity-pkce-code", state: null });

    await expect(completion).resolves.toEqual({ code: "identity-pkce-code" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(authorizeUrl.toString());
  });

  it("povolí přímou Microsoft Entra URL vrácenou Supabase linkIdentity", async () => {
    let resolveCode!: (value: { code: string; state: string | null }) => void;
    const waitForCode = new Promise<{ code: string; state: string | null }>((resolve) => {
      resolveCode = resolve;
    });
    register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL(
      "https://login.microsoftonline.com/f84a89a3-e428-4deb-8c95-a2b2decfb656/oauth2/v2.0/authorize",
    );
    authorizeUrl.searchParams.set("client_id", "11111111-2222-4333-8444-555555555555");
    authorizeUrl.searchParams.set("prompt", "select_account");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);
    authorizeUrl.searchParams.set("redirect_uri", "https://project.supabase.co/auth/v1/callback");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set(
      "scope",
      "openid email offline_access https://graph.microsoft.com/.default",
    );
    authorizeUrl.searchParams.set("skip_http_redirect", "true");

    const completion = complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    });
    resolveCode({ code: "identity-pkce-code", state: null });

    await expect(completion).resolves.toEqual({ code: "identity-pkce-code" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(authorizeUrl.toString());
  });

  it("odmítne podvržené varianty přímé Microsoft Entra URL", async () => {
    register(new Promise(() => undefined));
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const createAuthorizeUrl = (): URL => {
      const url = new URL(
        "https://login.microsoftonline.com/f84a89a3-e428-4deb-8c95-a2b2decfb656/oauth2/v2.0/authorize",
      );
      url.searchParams.set("client_id", "11111111-2222-4333-8444-555555555555");
      url.searchParams.set("prompt", "select_account");
      url.searchParams.set("redirect_to", flow.redirectTo);
      url.searchParams.set("redirect_uri", "https://project.supabase.co/auth/v1/callback");
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        "openid email offline_access https://graph.microsoft.com/.default",
      );
      url.searchParams.set("skip_http_redirect", "true");
      return url;
    };

    const wrongCallback = createAuthorizeUrl();
    wrongCallback.searchParams.set("redirect_uri", "https://evil.example/callback");
    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: wrongCallback.toString(),
    })).rejects.toThrow("Blocked Supabase OAuth authorize URL");

    const expandedScopes = createAuthorizeUrl();
    expandedScopes.searchParams.set(
      "scope",
      "openid email offline_access https://graph.microsoft.com/.default Files.ReadWrite.All",
    );
    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: expandedScopes.toString(),
    })).rejects.toThrow("Blocked Supabase OAuth authorize URL");

    const genericTenant = createAuthorizeUrl();
    genericTenant.pathname = "/common/oauth2/v2.0/authorize";
    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: genericTenant.toString(),
    })).rejects.toThrow("Blocked Supabase OAuth authorize URL");

    expect(electronMocks.openExternal).not.toHaveBeenCalled();
  });

  it("při opakování ve stejném rendereru znovu použije připravený flow", async () => {
    const waitForCode = new Promise<{ code: string; state: string | null }>(() => undefined);
    const startLoopbackServer = register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;

    const first = await start({ sender });
    const repeated = await start({ sender });

    expect(repeated).toEqual(first);
    expect(startLoopbackServer).toHaveBeenCalledTimes(1);
  });

  it("sloučí i dva souběžné starty ze stejného rendereru", async () => {
    const waitForCode = new Promise<{ code: string; state: string | null }>(() => undefined);
    let resolveServer!: (value: { port: number; waitForCode: typeof waitForCode }) => void;
    const startLoopbackServer = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveServer = resolve;
    }));
    register(waitForCode, startLoopbackServer);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;

    const firstPending = start({ sender });
    const repeatedPending = start({ sender });
    resolveServer({ port: 43123, waitForCode });

    const [first, repeated] = await Promise.all([firstPending, repeatedPending]);
    expect(repeated).toEqual(first);
    expect(startLoopbackServer).toHaveBeenCalledTimes(1);
  });

  it("nedovolí jinému rendereru převzít ani dokončit aktivní flow", async () => {
    const waitForCode = new Promise<{ code: string; state: string | null }>(() => undefined);
    register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL("https://project.supabase.co/auth/v1/authorize");
    authorizeUrl.searchParams.set("provider", "azure");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);

    await expect(start({ sender: otherSender })).rejects.toThrow("Přihlášení Microsoft již probíhá v jiném okně");
    await expect(complete({ sender: otherSender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    })).rejects.toThrow("OAuth flow nepatří tomuto oknu");
    expect(electronMocks.openExternal).not.toHaveBeenCalled();
  });

  it("drží flow rezervovaný až do návratu autorizačního kódu", async () => {
    let resolveCode!: (value: { code: string; state: string | null }) => void;
    const waitForCode = new Promise<{ code: string; state: string | null }>((resolve) => {
      resolveCode = resolve;
    });
    register(waitForCode);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL("https://project.supabase.co/auth/v1/authorize");
    authorizeUrl.searchParams.set("provider", "azure");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);

    const completion = complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    });
    await vi.waitFor(() => expect(electronMocks.openExternal).toHaveBeenCalledTimes(1));
    await expect(start({ sender: otherSender })).rejects.toThrow("Přihlášení Microsoft již probíhá v jiném okně");

    resolveCode({ code: "pkce-code", state: null });
    await expect(completion).resolves.toEqual({ code: "pkce-code" });
  });

  it("po selhání otevření prohlížeče dovolí stejnému rendereru flow zopakovat", async () => {
    const waitForCode = new Promise<{ code: string; state: string | null }>(() => undefined);
    const startLoopbackServer = register(waitForCode);
    electronMocks.openExternal.mockRejectedValueOnce(new Error("Browser unavailable"));
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;
    const complete = electronMocks.handlers.get("oauth:completeSupabaseFlow")!;
    const flow = await start({ sender });
    const authorizeUrl = new URL("https://project.supabase.co/auth/v1/authorize");
    authorizeUrl.searchParams.set("provider", "azure");
    authorizeUrl.searchParams.set("redirect_to", flow.redirectTo);

    await expect(complete({ sender }, {
      flowId: flow.flowId,
      authorizeUrl: authorizeUrl.toString(),
    })).rejects.toThrow("Browser unavailable");

    await expect(start({ sender })).resolves.toEqual(flow);
    expect(startLoopbackServer).toHaveBeenCalledTimes(1);
  });

  it("po timeoutu uvolní flow pro nový pokus", async () => {
    let rejectFirst!: (reason: Error) => void;
    const firstWait = new Promise<{ code: string; state: string | null }>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const secondWait = new Promise<{ code: string; state: string | null }>(() => undefined);
    const startLoopbackServer = vi.fn()
      .mockResolvedValueOnce({ port: 43123, waitForCode: firstWait })
      .mockResolvedValueOnce({ port: 43124, waitForCode: secondWait });
    register(firstWait, startLoopbackServer);
    const start = electronMocks.handlers.get("oauth:startSupabaseFlow")!;

    const first = await start({ sender });
    rejectFirst(new Error("OAuth timeout"));
    await expect(firstWait).rejects.toThrow("OAuth timeout");
    await vi.waitFor(() => expect(startLoopbackServer).toHaveBeenCalledTimes(1));

    const second = await start({ sender });
    expect(second.flowId).not.toBe(first.flowId);
    expect(second.redirectTo).toBe("http://127.0.0.1:43124/oauth2/callback");
    expect(startLoopbackServer).toHaveBeenCalledTimes(2);
  });
});
