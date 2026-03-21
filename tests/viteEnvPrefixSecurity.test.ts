import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("vite env prefix hardening", () => {
  it("nevystavuje TINY_URL_ proměnné do klientského bundlu", () => {
    const source = fs.readFileSync(path.join(ROOT, "vite.config.ts"), "utf8");

    expect(source).toContain("envPrefix: 'VITE_',");
    expect(source).not.toContain("envPrefix: ['VITE_', 'TINY_URL_']");
    expect(source).not.toContain('envPrefix: ["VITE_", "TINY_URL_"]');
  });
});
