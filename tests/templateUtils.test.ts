import { describe, expect, it } from "vitest";
import { processTemplate, renderTemplateHtml, sanitizeEmailHtml } from "@/shared/email/templateUtils";
import { processTemplate as processTemplateFromLegacy } from "../utils/templateUtils";
import type { ProjectDetails } from "../types";

const createProject = (
  overrides: Partial<ProjectDetails> = {},
): ProjectDetails =>
  ({
    id: "project-1",
    title: "Projekt A",
    investor: "Investor",
    location: "Praha",
    finishDate: "2026-12-31",
    siteManager: "Vedoucí stavby",
    categories: [],
    ...overrides,
  }) as ProjectDetails;

describe("templateUtils", () => {
  it("zachová HTML strukturu podpisu při vložení do HTML šablony", () => {
    const html = processTemplate(
      "<p>Dobrý den,</p>\n{PODPIS_UZIVATELE}",
      createProject(),
      undefined,
      "html",
      "<div class=\"signature\"><p>S pozdravem</p><p><strong>Jan Novák</strong></p></div>",
    );

    expect(html).toContain("<p>Dobrý den,</p>");
    expect(html).toContain("<div class=\"signature\">");
    expect(html).toContain("<p>S pozdravem</p>");
    expect(html).toContain("<p><strong>Jan Novák</strong></p>");
  });

  it("zůstává dostupné přes legacy template utils entrypoint", () => {
    expect(processTemplateFromLegacy("Ahoj {JMENO}", { "{JMENO}": "Jana" })).toBe("Ahoj Jana");
  });

  it("převede HTML podpis do textového fallbacku bez syrových tagů", () => {
    const text = processTemplate(
      "Dobrý den,\n{PODPIS_UZIVATELE}",
      createProject(),
      undefined,
      "text",
      "<div><p>S pozdravem</p><p><strong>Jan Novák</strong></p></div>",
    );

    expect(text).toContain("Dobrý den,");
    expect(text).toContain("S pozdravem");
    expect(text).toContain("Jan Novák");
    expect(text).not.toContain("<div>");
    expect(text).not.toContain("<strong>");
  });

  it("sanitizuje nebezpečný HTML podpis", () => {
    const html = processTemplate(
      "{PODPIS_UZIVATELE}",
      createProject(),
      undefined,
      "html",
      "<img src=\"https://example.com/logo.png\" onerror=\"alert(1)\"><script>alert(1)</script><a href=\"javascript:alert(1)\" onclick=\"alert(1)\">Profil</a>",
    );

    expect(html).toContain("<img");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain("javascript:alert");
  });

  it("escapuje projektové proměnné v HTML šabloně a zachová jen bezpečné odkazy", () => {
    const html = processTemplate(
      "<p>{NAZEV_STAVBY}</p>{ODKAZ_DOKUMENTACE}{POPIS_PRACI}",
      createProject({
        title: "<img src=x onerror=alert(1)>",
        documentLinks: [
          {
            id: "safe-link",
            label: "Bezpečný <b>odkaz</b>",
            url: "https://example.com/docs?x=1",
            type: "url",
            createdAt: "2026-01-01",
          },
          {
            id: "bad-link",
            label: "Nebezpečný",
            url: "javascript:alert(1)",
            type: "url",
            createdAt: "2026-01-01",
          },
        ],
        categories: [
          {
            id: "cat-1",
            title: "Kategorie",
            workItems: ["Montáž <script>alert(1)</script>"],
          },
        ],
      }),
      undefined,
      "html",
    );

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain('href="https://example.com/docs?x=1"');
    expect(html).toContain("Bezpečný &lt;b&gt;odkaz&lt;/b&gt;");
    expect(html).toContain("Montáž &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:alert");
    expect(html).not.toContain("<script>");
  });

  it("sanitizuje výsledné HTML tělo emailu včetně atributů a href", () => {
    const html = sanitizeEmailHtml(
      '<p onclick="alert(1)">Text</p><a href="javascript:alert(1)">link</a><script>alert(1)</script>',
    );

    expect(html).toContain("<p>Text</p>");
    expect(html).toContain("<a>link</a>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
  });

  it("převádí nové řádky jen v textových částech mimo HTML tagy", () => {
    const html = renderTemplateHtml("Řádek 1\nŘádek 2<div><p>Podpis</p></div>");

    expect(html).toBe("Řádek 1<br>Řádek 2<div><p>Podpis</p></div>");
  });
});
