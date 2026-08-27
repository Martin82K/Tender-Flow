import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("veřejná CTA paleta", () => {
  it("používá pro landing a přihlášení samostatnou tlumenou zelenou", () => {
    const landingStyles = readProjectFile("features/public/ui/landing-apex.css");
    const authStyles = readProjectFile("features/auth/ui/auth-apex.css");

    expect(landingStyles).toContain("--cta:#86b79b");
    expect(landingStyles).toMatch(/\.btn-hero-primary\{[^}]*background:var\(--cta\)/);
    expect(landingStyles).toMatch(/\.story-steps button\.active\{[^}]*background:var\(--cta\)/);
    expect(authStyles).toMatch(
      /\.auth-btn-primary\s*\{[^}]*background:\s*var\(--auth-accent\)/s,
    );
  });

  it("sjednocuje interaktivní auth akcenty do zářivé zelené palety", () => {
    const authStyles = readProjectFile("features/auth/ui/auth-apex.css");

    expect(authStyles).toContain("--auth-accent: #6fdfa3");
    expect(authStyles).toContain("--auth-accent-hover: #8ceab6");
    expect(authStyles).toMatch(/\.auth-card-accent\s*\{[^}]*var\(--auth-accent\)/s);
    expect(authStyles).toMatch(/\.auth-input:focus\s*\{[^}]*var\(--auth-accent\)/s);
    expect(authStyles).toMatch(
      /\.auth-checkbox input\[type="checkbox"\]:checked,[\s\S]*?background:\s*var\(--auth-accent\)/,
    );
    expect(authStyles).toMatch(
      /\.auth-btn-primary:hover\s*\{[^}]*background:\s*var\(--auth-accent-hover\)/s,
    );
    expect(authStyles).toMatch(
      /html\[data-skin="space"\] \.auth-apex-page \.auth-input:focus\s*\{[^}]*var\(--auth-accent\)[^}]*!important/s,
    );
    expect(authStyles).not.toContain("border-color: #ff8a33");
    expect(authStyles).not.toContain("rgba(255, 138, 51, 0.18)");
  });

  it("odstraňuje modrou z metriky a interaktivních stavů příběhu na landing page", () => {
    const landingStyles = readProjectFile("features/public/ui/landing-apex.css");

    expect(landingStyles).toMatch(
      /\.story-panel-kicker\s*\{[^}]*color:var\(--cta\)/s,
    );
    expect(landingStyles).toMatch(
      /\.story-panel-metric\s*\{[^}]*background:var\(--green-dim\)[^}]*color:var\(--cta-hover\)/s,
    );
    expect(landingStyles).toMatch(
      /\.story-steps button:hover\s*\{[^}]*background:var\(--green-dim\)[^}]*color:var\(--cta-hover\)/s,
    );
    expect(landingStyles).toMatch(
      /\.story-steps button:focus-visible\s*\{[^}]*var\(--cta-hover\)/s,
    );
    expect(landingStyles).toMatch(
      /html\[data-skin="space"\] \.landing-apex \.story-steps button\.active\s*\{[^}]*var\(--cta\)[^}]*!important/s,
    );
    expect(landingStyles).toMatch(
      /\.marquee-item::after\s*\{[^}]*content:'\\25C6 ';[^}]*color:var\(--green\)/s,
    );
    expect(landingStyles).not.toContain("color:#aebcff");
    expect(landingStyles).not.toContain("outline:2px solid #8fa9ff");
  });
});
