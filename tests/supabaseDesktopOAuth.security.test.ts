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

const sender = {} as Electron.WebContents;

const register = (waitForCode: Promise<{ code: string; state: string | null }>) => {
  registerOAuthHandlers({
    parseUrl: (value) => new URL(value),
    isAllowedExternalUrl: () => true,
    createCodeVerifier: () => "verifier",
    createCodeChallenge: () => "challenge",
    startLoopbackServer: vi.fn().mockResolvedValue({ port: 43123, waitForCode }),
    requireAuth: vi.fn(),
    isTrustedSender: () => true,
    getSupabaseUrl: () => "https://project.supabase.co",
  });
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
});
