import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const AUTH_SCAN_ROOTS = ["app", "hooks", "context", "infra"];
const THEME_CONTRACT_SCAN_ROOTS = ["app", "components", "features", "shared"];
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
  it("rejects template-literal and normalized alias bypasses of feature boundaries", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-feature-boundary-bypass-"));
    const projectsDir = path.join(fixtureRoot, "features/projects");
    const tasksDir = path.join(fixtureRoot, "features/tasks");
    const configDir = path.join(fixtureRoot, "config");
    const consumerPath = path.join(tasksDir, "consumer.ts");
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");

    fs.mkdirSync(path.join(projectsDir, "model"), { recursive: true });
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(projectsDir, "index.ts"), 'export { value } from "./model/private";\n');
    fs.writeFileSync(path.join(projectsDir, "model/private.ts"), "export const value = 1;\n");
    fs.writeFileSync(
      path.join(configDir, "architecture-boundary-allowlist.json"),
      JSON.stringify({ allowedFindings: [] }),
    );

    const runBoundaryCheck = () =>
      execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      });

    try {
      fs.writeFileSync(consumerPath, "const load = () => import(`@features/projects/model/private`);\nvoid load;\n");
      expect(runBoundaryCheck).toThrow(/feature-private-import/);

      fs.writeFileSync(
        consumerPath,
        'import { value } from "@features/tasks/../projects/model/private";\nvoid value;\n',
      );
      expect(runBoundaryCheck).toThrow(/feature-private-import/);

      fs.writeFileSync(
        consumerPath,
        "const load = () => import(`@/features/tasks/../projects/model/private`);\nvoid load;\n",
      );
      expect(runBoundaryCheck).toThrow(/feature-private-import/);

      fs.writeFileSync(
        consumerPath,
        "const load = () => import(`@features/tasks/../projects`);\nvoid load;\n",
      );
      expect(runBoundaryCheck).not.toThrow();
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects private cross-feature imports while allowing public feature entrypoints", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-feature-boundary-"));
    const projectsDir = path.join(fixtureRoot, "features/projects");
    const tasksDir = path.join(fixtureRoot, "features/tasks");
    const configDir = path.join(fixtureRoot, "config");
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");

    fs.mkdirSync(path.join(projectsDir, "model"), { recursive: true });
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(projectsDir, "index.ts"), 'export { value } from "./model/private";\n');
    fs.writeFileSync(path.join(projectsDir, "model/private.ts"), "export const value = 1;\n");
    fs.writeFileSync(path.join(projectsDir, "model/other.ts"), "export const other = 2;\n");

    const runBoundaryCheck = () =>
      execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      });

    try {
      fs.writeFileSync(
        path.join(tasksDir, "consumer.ts"),
        'import { value } from "@features/projects/model/private";\nvoid value;\n',
      );

      let privateImportError: unknown;
      try {
        runBoundaryCheck();
      } catch (error) {
        privateImportError = error;
      }

      expect(privateImportError).toBeDefined();
      expect(String((privateImportError as { stderr?: string }).stderr ?? privateImportError)).toContain(
        "feature-private-import",
      );

      fs.writeFileSync(
        path.join(configDir, "architecture-boundary-allowlist.json"),
        JSON.stringify({
          allowedFindings: [
            {
              type: "feature-private-import",
              file: "features/tasks/consumer.ts",
              specifier: "@features/projects/model/private",
            },
          ],
        }),
      );
      expect(runBoundaryCheck).not.toThrow();

      fs.writeFileSync(
        path.join(tasksDir, "consumer.ts"),
        'import { other } from "@features/projects/model/other";\nvoid other;\n',
      );
      expect(runBoundaryCheck).toThrow();

      fs.writeFileSync(
        path.join(tasksDir, "consumer.ts"),
        'import { value } from "@features/projects";\nvoid value;\n',
      );

      expect(runBoundaryCheck).toThrow();
      fs.writeFileSync(
        path.join(configDir, "architecture-boundary-allowlist.json"),
        JSON.stringify({ allowedFindings: [] }),
      );
      expect(runBoundaryCheck).not.toThrow();
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

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
      dependencyFindings: Record<string, Array<{ file: string; target: string }>>;
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
    expect(report.dependencyFindings["features-to-legacy-utils"]).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-hooks"].filter(
        (item) => item.target === "hooks/useTheme",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-hooks"].filter(
        (item) => item.target === "hooks/queries/useProjectDetailsQuery",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-hooks"].filter(
        (item) => item.target === "hooks/queries/useOverviewTenantDataQuery",
      ),
    ).toHaveLength(0);
    expect(report.dependencyFindings["features-to-legacy-hooks"]).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) => item.file === "features/projects/model/useProjectOverviewController.ts",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) => item.file === "features/projects/hooks/useProjectsQuery.ts",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) =>
          item.file === "features/tasks/hooks/useTasksQuery.ts" ||
          item.file === "features/tasks/hooks/useTaskProjectsQuery.ts",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) =>
          item.file === "features/tasks/hooks/useTaskMutations.ts" ||
          item.file === "features/tasks/hooks/useTaskProjectMutations.ts",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) => item.file === "features/notifications/hooks/useNotifications.ts",
      ),
    ).toHaveLength(0);
    expect(
      report.dependencyFindings["features-to-legacy-context"].filter(
        (item) => item.file === "features/projects/contracts/forms/VendorRatingDialog.tsx",
      ),
    ).toHaveLength(0);
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
    expect(report.sharedUi.temporaryShims.map((item) => item.file)).not.toContain("shared/ui/projects/ProjectOverviewNew.tsx");
    expect(report.sharedUi.primitives.every((item) => item.file.startsWith("shared/ui/"))).toBe(true);
    expect(report.largeFiles.every((item) => item.lines > 800)).toBe(true);
    expect(report.rootFiles.moveCandidates).toHaveLength(0);
    expect(report.rootFiles.reviewCandidates.some((item) => item.file === "server.js")).toBe(true);
    expect(report.rootFiles.sensitiveTracked).toHaveLength(0);
  });

  it("routes notification UI mutations through the auth-aware hook", () => {
    const notificationCenterSource = fs.readFileSync(
      path.join(ROOT, "features/notifications/ui/NotificationCenter.tsx"),
      "utf8",
    );
    expect(notificationCenterSource).not.toContain("../api/notificationApi");
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

  it("imports theme contracts from shared types instead of the runtime hook", () => {
    const files = THEME_CONTRACT_SCAN_ROOTS.flatMap((dir) => collectFiles(dir));
    const legacyTypeImports: string[] = [];
    const importPattern = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@\/hooks\/useTheme["'];?/g;

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const content = fs.readFileSync(file, "utf8");

      for (const match of content.matchAll(importPattern)) {
        if (/\bTheme(?:Mode|Skin)\b/.test(match[1] ?? "")) {
          legacyTypeImports.push(rel);
        }
      }
    }

    expect(legacyTypeImports).toEqual([]);
  });
});
