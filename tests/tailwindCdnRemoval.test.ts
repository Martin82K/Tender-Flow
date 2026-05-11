import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("bundlovaný Tailwind", () => {
  it("nenačítá Tailwind Play CDN ani runtime init skript", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).not.toContain("cdn.tailwindcss.com");
    expect(html).not.toContain("https://cdn.tailwindcss.com");
    expect(html).not.toContain("tailwind.config");
    expect(html).not.toContain("tailwind =");
    expect(html).not.toContain("tailwind-init.js");
  });

  it("má lokální Tailwind theme tokeny pro custom utility", () => {
    const css = readFileSync(resolve(root, "index.css"), "utf8");
    const entrypoint = readFileSync(resolve(root, "index.tsx"), "utf8");

    expect(entrypoint).toContain("import './index.css'");
    expect(css).toContain("@import \"tailwindcss\"");
    expect(css).toContain("@source \"./components/**/*.{js,ts,jsx,tsx}\"");
    expect(css).toContain("@custom-variant dark");
    expect(css).toContain("@theme");
    expect(css).toContain("--color-primary: rgb(var(--tf-color-primary-rgb))");
    expect(css).toContain("--color-background-light: var(--tf-color-background-light)");
    expect(css).toContain("--font-display: Inter, sans-serif");
  });
});
