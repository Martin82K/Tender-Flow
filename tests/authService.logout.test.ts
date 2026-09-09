import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("../services/supabase", () => ({
  supabase: { auth: { signOut: mocks.signOut } },
  getStoredAuthSessionRaw: vi.fn(),
}));
vi.mock("../services/functionsClient", () => ({ invokePublicFunction: vi.fn() }));

import { authService } from "../services/authService";

describe("authService.logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("odhlásí jen aktuální session a vyčistí její lokální cache", async () => {
    localStorage.setItem("crm-user-cache", "cached-user");
    localStorage.setItem("crm-subscription-tier-cache", "cached-tier");

    await authService.logout();

    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(localStorage.getItem("crm-user-cache")).toBeNull();
    expect(localStorage.getItem("crm-subscription-tier-cache")).toBeNull();
  });

  it("předá chybu odhlášení bez globálního odpojení ostatních zařízení", async () => {
    const error = new Error("Sign out unavailable");
    mocks.signOut.mockResolvedValue({ error });

    await expect(authService.logout()).rejects.toBe(error);
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
});
