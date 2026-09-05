import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("veřejná CTA paleta", () => {
  it("používá pro landing a přihlášení společnou barvu CTA", () => {
    const landingStyles = readProjectFile("features/public/ui/landing-apex.css");
    const authStyles = readProjectFile("features/auth/ui/auth-apex.css");

    expect(landingStyles).toContain("--cta:#af4821");
    expect(landingStyles).toMatch(/\.btn-hero-primary\{[^}]*background:var\(--cta\)/);
    expect(landingStyles).toMatch(/\.story-steps button\.active\{[^}]*background:var\(--cta\)/);
    expect(authStyles).toMatch(
      /\.auth-btn-primary\s*\{[^}]*background:\s*var\(--auth-accent\)/s,
    );
  });

  it("přebírá interaktivní auth akcenty z aktuální landing palety", () => {
    const authStyles = readProjectFile("features/auth/ui/auth-apex.css");

    expect(authStyles).toContain("--auth-accent: var(--cta)");
    expect(authStyles).toContain("--auth-accent-hover: var(--cta-hover)");
    expect(authStyles).toMatch(/\.auth-card-accent\s*\{[^}]*var\(--auth-accent\)/s);
    expect(authStyles).toMatch(/\.auth-input:focus\s*\{[^}]*var\(--auth-accent\)/s);
    expect(authStyles).toMatch(
      /\.auth-checkbox input\[type="checkbox"\]:checked,[\s\S]*?background:\s*var\(--auth-accent\)/,
    );
    expect(authStyles).toMatch(
      /\.auth-btn-primary:hover\s*\{[^}]*background:\s*var\(--auth-accent-hover\)/s,
    );
    expect(authStyles).toMatch(
      /html\[data-skin\] \.auth-apex-page \.auth-input:focus\s*\{[^}]*var\(--auth-accent\)[^}]*!important/s,
    );
    expect(authStyles).toMatch(
      /html\[data-skin\] \.auth-apex-page :is\(button, a, input, summary, \[tabindex\]\):focus-visible\s*\{[^}]*var\(--auth-accent\)[^}]*!important/s,
    );
    expect(authStyles).toMatch(
      /html\[data-skin\] \.auth-apex-page \.auth-input:-webkit-autofill:focus\s*\{[^}]*1000px var\(--bg-card\) inset[^}]*var\(--auth-accent-glow\)[^}]*!important/s,
    );
    expect(authStyles).not.toContain("border-color: #ff8a33");
    expect(authStyles).not.toContain("rgba(255, 138, 51, 0.18)");
  });

  it("nepoužívá modrou systémovou barvu při výběru textu v auth formuláři", () => {
    const authStyles = readProjectFile("features/auth/ui/auth-apex.css");

    expect(authStyles).toMatch(
      /\.auth-apex-page ::selection\s*\{[^}]*background:\s*var\(--auth-accent\)/s,
    );
  });

  it("ponechává přihlášení viditelné i v úzké mobilní navigaci", () => {
    const landingStyles = readProjectFile("features/public/ui/landing-apex.css");

    expect(landingStyles).not.toMatch(
      /@media\s*\(max-width:\s*480px\)\s*\{[^}]*\.landing-apex \.btn-login\s*\{\s*display:\s*none/s,
    );
    expect(landingStyles).toMatch(
      /@media\s*\(max-width:\s*480px\)\s*\{[^}]*\.landing-apex\.auth-apex-page \.btn-login\s*\{\s*display:\s*none/s,
    );
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
    expect(landingStyles).not.toContain("color:#aebcff");
    expect(landingStyles).not.toContain("outline:2px solid #8fa9ff");
  });
});
