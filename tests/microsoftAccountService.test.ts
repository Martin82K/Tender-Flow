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
    },
  },
}));

import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";

describe("microsoftAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSupabaseFlow.mockResolvedValue(null);
    mocks.invoke.mockResolvedValue({ connected: false });
  });

  it("čte globální stav bez projectId", async () => {
    await microsoftAccountService.getStatus();

    expect(mocks.invoke).toHaveBeenCalledWith("dochub-personal-microsoft", {
      body: { action: "status" },
      retries: 1,
    });
  });

  it("žádá pouze osobní read-only grant a neváže ho na stavbu", async () => {
    mocks.invoke.mockResolvedValue({ url: "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize" });

    await microsoftAccountService.connectDocumentAccess();

    expect(mocks.invoke).toHaveBeenCalledWith("dochub-auth-url", expect.objectContaining({
      body: expect.objectContaining({
        provider: "onedrive",
        accessKind: "personal_read",
      }),
    }));
    expect(mocks.invoke.mock.calls[0][1].body).not.toHaveProperty("projectId");
    expect(mocks.openExternal).toHaveBeenCalledTimes(1);
  });
});
