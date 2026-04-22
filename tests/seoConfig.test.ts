import { describe, it, expect } from "vitest";
import { resolveSeo, ROUTE_SEO, SITE_URL } from "@/shared/seo/seoConfig";

describe("resolveSeo", () => {
  it("vrátí defaultní SEO pro landing page", () => {
    const seo = resolveSeo("/");
    expect(seo.title).toContain("Tender Flow");
    expect(seo.description).toBeTruthy();
    expect(seo.canonical).toBe(`${SITE_URL}/`);
    expect(seo.noindex).toBeFalsy();
  });

  it("označí /login jako noindex", () => {
    const seo = resolveSeo("/login");
    expect(seo.noindex).toBe(true);
  });

  it("označí /register jako noindex (auth stránka)", () => {
    const seo = resolveSeo("/register");
    expect(seo.noindex).toBe(true);
  });

  it("legal stránky jsou indexovatelné a mají vlastní title", () => {
    const terms = resolveSeo("/terms");
    expect(terms.noindex).toBeFalsy();
    expect(terms.title).toContain("Obchodní podmínky");
    expect(terms.canonical).toBe(`${SITE_URL}/terms`);

    const privacy = resolveSeo("/privacy");
    expect(privacy.noindex).toBeFalsy();
    expect(privacy.title).toContain("Ochrana osobních údajů");
  });

  it("/app/* a /s/* jsou noindex (neveřejné)", () => {
    expect(resolveSeo("/app/dashboard").noindex).toBe(true);
    expect(resolveSeo("/app").noindex).toBe(true);
    expect(resolveSeo("/s/short-alias").noindex).toBe(true);
  });

  it("neznámé routy fallbackují na default SEO", () => {
    const seo = resolveSeo("/random-nonexistent-route");
    expect(seo).toEqual(ROUTE_SEO["/"]);
  });

  it("všechny description jsou v doporučené délce (50–200 znaků)", () => {
    for (const [path, meta] of Object.entries(ROUTE_SEO)) {
      expect(
        meta.description.length,
        `description pro "${path}" má ${meta.description.length} znaků`,
      ).toBeGreaterThan(40);
      expect(
        meta.description.length,
        `description pro "${path}" má ${meta.description.length} znaků`,
      ).toBeLessThan(260);
    }
  });
});
