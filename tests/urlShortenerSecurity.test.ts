import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpcResult: { data: null as string | null, error: null as unknown },
  rpc: vi.fn(),
  authGetUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: (name: string, opts: unknown) => state.invokeAuthedFunction(name, opts),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => state.authGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
    rpc: (fn: string, args: unknown) => {
      if (fn === "get_short_url_target") {
        return Promise.resolve(state.rpcResult);
      }
      return state.rpc(fn, args);
    },
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
    state.rpcResult = { data: null, error: null };
    state.rpc.mockReset();
    state.authGetUser.mockClear();
    state.invokeAuthedFunction.mockReset();
  });

  it("blokuje nebezpecna schema v redirect URL", () => {
    expect(normalizeSafeShortRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("data:text/html,boom")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("http://example.com/path")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("blokuje credential URL a lokalni nebo privatni hosty", () => {
    expect(normalizeSafeShortRedirectUrl("https://user:pass@example.com/path")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://localhost/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://127.0.0.1/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://2130706433/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://0x7f000001/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://192.168.1.10/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://[::1]/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://[::ffff:127.0.0.1]/admin")).toBeNull();
    expect(normalizeSafeShortRedirectUrl("https://crm.internal/admin")).toBeNull();
  });

  it("shortenUrl odmitne nebezpecny cil bez volani provideru", async () => {
    const result = await shortenUrl("javascript:alert(1)");
    expect(result.success).toBe(false);
    expect(result.error).toContain("veřejné HTTPS");
    expect(state.invokeAuthedFunction).not.toHaveBeenCalled();
  });

  it("shortenUrlWithAlias odmitne nebezpecny cil", async () => {
    const result = await shortenUrlWithAlias("data:text/html,boom", "safe-alias");
    expect(result.success).toBe(false);
    expect(result.error).toContain("veřejné HTTPS");
  });

  it("getOriginalUrl blokuje unsafe redirect target a neinkrementuje kliky", async () => {
    state.rpcResult = {
      data: "javascript:alert(1)",
      error: null,
    };

    const result = await getOriginalUrl("abc123");
    expect(result.url).toBeNull();
    expect(result.error).toContain("Unsafe redirect target blocked");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("getOriginalUrl blokuje lokalni cil a neinkrementuje kliky", async () => {
    state.rpcResult = {
      data: "https://localhost/admin",
      error: null,
    };

    const result = await getOriginalUrl("abc123");
    expect(result.url).toBeNull();
    expect(result.error).toContain("Unsafe redirect target blocked");
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
