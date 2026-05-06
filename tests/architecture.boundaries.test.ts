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

  it("architecture debt audit reports the planned refactor categories", () => {
    const output = execFileSync("node", ["scripts/audit-architecture-debt.mjs", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    const report = JSON.parse(output) as {
      dependencyFindings: Record<string, unknown[]>;
      sharedUi: {
        temporaryShims: Array<{ file: string; targets: string[] }>;
        primitives: Array<{ file: string }>;
      };
      largeFiles: Array<{ file: string; lines: number }>;
      rootFiles: {
        moveCandidates: Array<{ file: string }>;
        reviewCandidates: Array<{ file: string }>;
        sensitiveTracked: string[];
      };
    };

    expect(Object.keys(report.dependencyFindings).sort()).toEqual([
      "features-to-legacy-context",
      "features-to-legacy-hooks",
      "features-to-legacy-services",
      "features-to-legacy-utils",
      "shared-to-components",
    ]);
    expect(report.sharedUi.temporaryShims.every((item) => item.file.startsWith("shared/ui/"))).toBe(true);
    expect(report.sharedUi.temporaryShims.every((item) => item.targets.every((target) => target.startsWith("components/")))).toBe(
      true,
    );
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/projects/ProjectSchedule.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/projects/TenderPlan.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/KPICard.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/StatusCard.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/SupplierTable.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/SupplierBarChart.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/StatusDistributionChart.tsx");
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/overview/BudgetDeviationGauge.tsx");
    expect(report.sharedUi.primitives.every((item) => item.file.startsWith("shared/ui/"))).toBe(true);
    expect(report.largeFiles.every((item) => item.lines > 800)).toBe(true);
    expect(report.rootFiles.moveCandidates).toHaveLength(0);
    expect(report.rootFiles.reviewCandidates.some((item) => item.file === "server.js")).toBe(true);
    expect(report.rootFiles.sensitiveTracked).toHaveLength(0);
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
