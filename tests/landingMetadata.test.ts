import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SEO, ROUTE_SEO } from "@shared/seo/seoConfig";

describe("public landing metadata", () => {
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
