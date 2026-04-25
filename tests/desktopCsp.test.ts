import { describe, expect, it } from "vitest";
import { buildDesktopCsp, shouldInjectDesktopCsp } from "../desktop/main/services/csp";

describe("desktop CSP", () => {
  it("allows GoPay domains required for payment gateway and iframe rendering", () => {
    const csp = buildDesktopCsp(true);

    expect(csp).toContain("connect-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("script-src-elem");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("https://gw.sandbox.gopay.com");
    expect(csp).toContain("https://gate.gopay.cz");
    expect(csp).toContain("https://*.gopay.com");
    expect(csp).toContain("https://*.gopay.cz");
    expect(csp).toContain("https://ares.gov.cz");
  });

  it("keeps production policy without unsafe-eval or unsafe-inline", () => {
    const csp = buildDesktopCsp(false);

    // 'unsafe-eval' is required because the Tailwind Play CDN evaluates JS at runtime
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("default-src 'self'");
    // script-src must NOT contain unsafe-inline in production
    expect(csp).toContain("script-src 'self' 'unsafe-eval' https://cdn.tailwindcss.com");
    expect(csp).toContain("script-src-elem 'self' 'unsafe-eval' https://cdn.tailwindcss.com");
    expect(csp).toContain("frame-src 'self' https://gw.sandbox.gopay.com https://gate.gopay.cz https://*.gopay.com https://*.gopay.cz");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("injects desktop CSP only for app-owned renderer responses", () => {
    expect(shouldInjectDesktopCsp("http://localhost:3000/", true)).toBe(true);
    expect(shouldInjectDesktopCsp("http://127.0.0.1:3000/@vite/client", true)).toBe(true);
    expect(shouldInjectDesktopCsp("file:///Applications/TenderFlow.app/index.html", false)).toBe(true);

    expect(shouldInjectDesktopCsp("https://gate.gopay.cz/api/payments", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://gw.sandbox.gopay.com/gw/pay-gate", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://example.supabase.co/rest/v1/projects", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00006947", true)).toBe(false);
  });
});
