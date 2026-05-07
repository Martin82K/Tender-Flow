import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDesktopCsp, shouldInjectDesktopCsp } from "../desktop/main/services/csp";

const root = process.cwd();

describe("desktop CSP", () => {
  it("allows Stripe checkout frame and app runtime domains only", () => {
    const csp = buildDesktopCsp(true);

    expect(csp).toContain("connect-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("script-src-elem");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("https://checkout.stripe.com");
    expect(csp).toContain("https://ares.gov.cz");
    expect(csp).toContain("'unsafe-eval'");
  });

  it("keeps production policy without unsafe-eval or unsafe-inline", () => {
    const csp = buildDesktopCsp(false);

    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("cdn.tailwindcss.com");
    // script-src must NOT contain unsafe-inline in production
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("script-src-elem 'self'");
    expect(csp).toContain("frame-src 'self' https://checkout.stripe.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("keeps ExcelJS out of statically loaded renderer modules", () => {
    const rendererExcelModules = [
      "features/projects/api/projectScheduleExportApi.ts",
      "shared/tools/excel/indexMatcher.ts",
      "shared/tools/excel/fillOddily.ts",
    ];

    for (const modulePath of rendererExcelModules) {
      const source = readFileSync(resolve(root, modulePath), "utf8");

      expect(source).not.toMatch(/^\s*import\s+(?!type\b)[\s\S]*?\sfrom\s+["']exceljs["']/m);
    }
  });

  it("injects desktop CSP only for app-owned renderer responses", () => {
    expect(shouldInjectDesktopCsp("http://localhost:3000/", true)).toBe(true);
    expect(shouldInjectDesktopCsp("http://127.0.0.1:3000/@vite/client", true)).toBe(true);
    expect(shouldInjectDesktopCsp("file:///Applications/TenderFlow.app/index.html", false)).toBe(true);

    expect(shouldInjectDesktopCsp("https://checkout.stripe.com/c/cs_test_123", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://example.supabase.co/rest/v1/projects", true)).toBe(false);
    expect(shouldInjectDesktopCsp("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00006947", true)).toBe(false);
  });
});
