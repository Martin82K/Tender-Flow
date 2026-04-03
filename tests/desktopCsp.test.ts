import { describe, expect, it } from "vitest";
import { buildDesktopCsp, shouldInjectDesktopCsp } from "../desktop/main/services/csp";

describe("desktop CSP", () => {
  it("allows Stripe domains required by Elements telemetry, script loading and iframe rendering", () => {
    const csp = buildDesktopCsp(true);

    expect(csp).toContain("connect-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("script-src-elem");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://r.stripe.com");
    expect(csp).toContain("https://m.stripe.com");
    expect(csp).toContain("https://q.stripe.com");
    expect(csp).toContain("https://m.stripe.network");
    expect(csp).toContain("https://*.stripe.com");
    expect(csp).toContain("https://*.stripe.network");
    expect(csp).toContain("https://hooks.stripe.com");
    expect(csp).toContain("https://ares.gov.cz");
  });

  it("keeps production policy without unsafe-eval", () => {
    const csp = buildDesktopCsp(false);

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.stripe.com https://*.stripe.com");
    expect(csp).toContain("script-src-elem 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.stripe.com https://*.stripe.com");
    expect(csp).toContain("frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("injects desktop CSP only for app-owned renderer responses", () => {
    expect(shouldInjectDesktopCsp("http://localhost:3000/", true)).toBe(true);
    expect(shouldInjectDesktopCsp("http://127.0.0.1:3000/@vite/client", true)).toBe(true);
    expect(shouldInjectDesktopCsp("file:///Applications/TenderFlow.app/index.html", false)).toBe(true);

    expect(shouldInjectDesktopCsp("https://js.stripe.com/v3", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://api.stripe.com/v1/elements/sessions", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://example.supabase.co/rest/v1/projects", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00006947", true)).toBe(false);
  });
});
