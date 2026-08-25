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
      /\.auth-btn-primary\s*\{[^}]*background:\s*var\(--cta\)/s,
    );
  });
});
