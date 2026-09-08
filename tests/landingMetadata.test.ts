import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SEO, ROUTE_SEO } from "@shared/seo/seoConfig";

describe("public landing metadata", () => {
  it("identifies the operator consistently with the published legal notice", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const organization = [...dom.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent || "{}"))
      .find((schema) => schema["@type"] === "Organization");
    expect(organization.name).toBe("Tender Flow");
    expect(organization.legalName).toBe("Martin Kalkuš");
    expect(organization.identifier.value).toBe("74907026");
    for (const file of ["index.html", "public/llms.txt", "scripts/prerender-public.mjs",
      "features/public/ui/LandingPage.tsx", "features/public/ui/LegalPageLayout.tsx"]) {
      expect(fs.readFileSync(file, "utf8"), file).not.toContain("TenderFlow s.r.o.");
    }
  });

  it("keeps the AI product brief aligned with the current commercial and integration offer", () => {
    const brief = fs.readFileSync("public/llms.txt", "utf8");
    expect(brief).toContain("Enterprise");
    expect(brief).toContain("bankovním převodem");
    expect(brief).toContain("Mistral AI");
    expect(brief).toContain("TODO Osobní");
    expect(brief).toContain("Microsoft To Do");
    expect(brief).toContain("potvrzení");
    expect(brief).toContain("https://www.tenderflow.cz/api/mcp");
    expect(brief).not.toMatch(/Starter|399 Kč|499 Kč|Stripe|Gemini|14 dní zdarma|read-only|REST API|plnou funkčnost|uživatel nikdy/i);
    expect(brief).not.toMatch(/5 dodavatel|14 dnů|30 dní|macOS 11/i);
  });

  it("publishes current answers consistently in JSON-LD, the no-JS page and the AI brief", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const schemas = [...dom.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent || "{}"));
    const faq = schemas.find((schema) => schema["@type"] === "FAQPage");
    const fallback = dom.querySelector("noscript")?.textContent?.replace(/\s+/g, " ");
    const brief = fs.readFileSync("public/llms.txt", "utf8");
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(6);
    for (const question of faq.mainEntity) {
      expect(fallback).toContain(question.name);
      expect(fallback).toContain(question.acceptedAnswer.text);
      expect(brief).toContain(question.acceptedAnswer.text);
    }
    expect(schemas.some((schema) => schema["@type"] === "HowTo")).toBe(false);
    expect(html).not.toMatch(/plnou funkčnost|Maximum 5 dodavatelů|do 14 dnů|ROI se nám/);
  });

  it("uses the deployed www origin across canonical metadata and the sitemap", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
    expect(DEFAULT_SEO.canonical).toBe("https://www.tenderflow.cz/");
    expect(html).not.toContain("https://tenderflow.cz");
    expect(sitemap).not.toContain("https://tenderflow.cz");
  });

  it("retains private-route exclusions for every explicitly listed crawler", () => {
    const robots = fs.readFileSync("public/robots.txt", "utf8");
    const groups = robots.split(/\n\s*\n/).filter((group) => /User-agent:/i.test(group));
    for (const crawler of ["*", "Googlebot", "OAI-SearchBot", "GPTBot", "Bingbot"]) {
      const group = groups.find((entry) => entry.split("\n").includes(`User-agent: ${crawler}`));
      expect(group, crawler).toContain("Disallow: /app/");
      expect(group, crawler).toContain("Disallow: /api/");
      expect(group, crawler).toContain("Disallow: /s/");
    }
  });

  it("publishes only the invoiced Enterprise offer without a trial or card processor", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const schemas = [...dom.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent || "{}"));
    const software = schemas.find((schema) => schema["@type"] === "SoftwareApplication");

    expect(software.offers).toHaveLength(1);
    expect(software.offers[0].name).toBe("Enterprise");
    expect(software.offers[0].description).toMatch(/faktur|převod/i);
    expect(software.offers[0]).not.toHaveProperty("price");
    expect(html).not.toMatch(/href="[^"]*\/register|"url":\s*"[^"]*\/register|Vytvořit účet zdarma/);
    expect(dom.head.textContent).not.toMatch(/Stripe|14 dní zdarma|Starter/i);
    expect(dom.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/Mistral AI/);
    expect(JSON.stringify(schemas)).toContain("MCP");
    expect(DEFAULT_SEO.description).toMatch(/Mistral AI/);
    expect(DEFAULT_SEO.description).not.toMatch(/zdarma|Stripe/i);
    expect(ROUTE_SEO["/register"].description).not.toMatch(/zdarma|karty/i);
  });
});
