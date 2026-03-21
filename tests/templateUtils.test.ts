import { describe, expect, it } from "vitest";
import { processTemplate, renderTemplateHtml } from "../utils/templateUtils";
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

  it("převádí nové řádky jen v textových částech mimo HTML tagy", () => {
    const html = renderTemplateHtml("Řádek 1\nŘádek 2<div><p>Podpis</p></div>");

    expect(html).toBe("Řádek 1<br>Řádek 2<div><p>Podpis</p></div>");
  });
});
