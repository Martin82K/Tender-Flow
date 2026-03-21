import { describe, expect, it } from "vitest";
import { buildDesktopCsp } from "../desktop/main/services/csp";

describe("desktop CSP", () => {
  it("allows Stripe domains required by Elements telemetry and API", () => {
    const csp = buildDesktopCsp(true);

    expect(csp).toContain("connect-src");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://r.stripe.com");
    expect(csp).toContain("https://m.stripe.com");
    expect(csp).toContain("https://q.stripe.com");
    expect(csp).toContain("https://m.stripe.network");
    expect(csp).toContain("https://*.stripe.com");
    expect(csp).toContain("https://*.stripe.network");
  });

  it("keeps production policy without unsafe-eval", () => {
    const csp = buildDesktopCsp(false);

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
