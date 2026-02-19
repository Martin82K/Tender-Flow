import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const AUTH_SCAN_ROOTS = ["app", "hooks", "context", "infra"];
const CODE_EXT = new Set([".ts", ".tsx"]);

const collectFiles = (dir: string): string[] => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const stack = [abs];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (CODE_EXT.has(path.extname(entry.name))) {
        out.push(next);
      }
    }
  }
  return out;
};

describe("Architecture Guardrails", () => {
  it("boundary script passes", () => {
    expect(() => {
      execFileSync("node", ["scripts/check-boundaries.mjs"], {
        cwd: ROOT,
        stdio: "pipe",
      });
    }).not.toThrow();
  });

  it("has a single auth state listener in renderer + infra auth layer", () => {
    const files = AUTH_SCAN_ROOTS.flatMap((dir) => collectFiles(dir));
    const matches: string[] = [];
    const regex = /onAuthStateChange\s*\(/g;

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const content = fs.readFileSync(file, "utf8");
      const count = [...content.matchAll(regex)].length;
      if (count > 0) {
        matches.push(`${rel}:${count}`);
      }
    }

    expect(matches).toHaveLength(1);
    expect(matches[0]).toContain("infra/auth/authSessionStore.ts");
  });
});
