import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  singleResult: { data: null as { original_url: string } | null, error: null as unknown },
  rpc: vi.fn(),
  authGetUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: (...args: unknown[]) => state.invokeAuthedFunction(...args),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => state.authGetUser(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => state.singleResult,
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
    rpc: (...args: unknown[]) => state.rpc(...args),
  },
}));

import {
  getOriginalUrl,
  normalizeSafeShortRedirectUrl,
  shortenUrl,
  shortenUrlWithAlias,
} from "@/services/urlShortenerService";

describe("urlShortenerService security", () => {
  beforeEach(() => {
    state.singleResult = { data: null, error: null };
    state.rpc.mockReset();
    state.authGetUser.mockClear();
    state.invokeAuthedFunction.mockReset();
  });

  it("blokuje nebezpecna schema v redirect URL", () => {
    expect(normalizeSafeShortRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("data:text/html,boom")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("shortenUrl odmitne nebezpecny cil bez volani provideru", async () => {
    const result = await shortenUrl("javascript:alert(1)");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Povolené jsou pouze http/https");
    expect(state.invokeAuthedFunction).not.toHaveBeenCalled();
  });

  it("shortenUrlWithAlias odmitne nebezpecny cil", async () => {
    const result = await shortenUrlWithAlias("data:text/html,boom", "safe-alias");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Povolené jsou pouze http/https");
  });

  it("getOriginalUrl blokuje unsafe redirect target a neinkrementuje kliky", async () => {
    state.singleResult = {
      data: { original_url: "javascript:alert(1)" },
      error: null,
    };

    const result = await getOriginalUrl("abc123");
    expect(result.url).toBeNull();
    expect(result.error).toContain("Unsafe redirect target blocked");
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
