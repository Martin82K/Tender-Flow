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

const createBoundaryReviewFixture = () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-feature-boundary-review-"));
  const projectsDir = path.join(fixtureRoot, "features/projects");
  const tasksDir = path.join(fixtureRoot, "features/tasks");
  const configDir = path.join(fixtureRoot, "config");
  const serverDir = path.join(fixtureRoot, "server");
  const consumerPath = path.join(tasksDir, "consumer.ts");
  const jsConsumerPath = path.join(tasksDir, "consumer.js");
  const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");

  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(projectsDir, "index.ts"), "export const value = 1;\n");
  fs.writeFileSync(path.join(serverDir, "private.ts"), "export const secret = 1;\n");
  fs.writeFileSync(
    path.join(configDir, "architecture-boundary-allowlist.json"),
    JSON.stringify({ allowedFindings: [] }),
  );

  return {
    fixtureRoot,
    consumerPath,
    jsConsumerPath,
    boundaryFails: () => {
      try {
        execFileSync(process.execPath, [boundaryScript], {
          cwd: fixtureRoot,
          encoding: "utf8",
          stdio: "pipe",
        });
        return false;
      } catch {
        return true;
      }
    },
  };
};

describe("Architecture Guardrails", () => {
  it("rejects normalized alias escape and re-entry", () => {
    const { fixtureRoot, consumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      const fixtureName = path.basename(fixtureRoot);
      fs.writeFileSync(
        consumerPath,
        `import { secret } from "@features/tasks/../../../${fixtureName}/server/private";\nvoid secret;\n`,
      );
      expect(boundaryFails()).toBe(true);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects dynamic imports with an options argument", () => {
    const { fixtureRoot, consumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      fs.writeFileSync(
        consumerPath,
        'const load = () => import("@/server/private", {});\nvoid load;\n',
      );
      expect(boundaryFails()).toBe(true);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects query-suffix boundary bypasses while allowing public entrypoints", () => {
    const { fixtureRoot, consumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      fs.writeFileSync(
        consumerPath,
        'const load = () => import("@features/projects/model/private?raw&x=../../../../tasks");\nvoid load;\n',
      );
      expect(boundaryFails()).toBe(true);

      fs.writeFileSync(
        consumerPath,
        'const load = () => import("@features/projects?raw");\nvoid load;\n',
      );
      expect(boundaryFails()).toBe(false);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("allows public trailing entrypoints and import examples in plain text", () => {
    const { fixtureRoot, consumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      fs.writeFileSync(
        consumerPath,
        'import { value } from "@features/tasks/../projects/";\nvoid value;\n',
      );
      expect(boundaryFails()).toBe(false);

      fs.writeFileSync(
        consumerPath,
        "// Example: import(`@features/projects/model/private`)\nexport const value = 1;\n",
      );
      expect(boundaryFails()).toBe(false);

      fs.writeFileSync(
        consumerPath,
        'const example = "import(`@features/projects/model/private`)";\nvoid example;\n',
      );
      expect(boundaryFails()).toBe(false);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects TypeScript import types", () => {
    const { fixtureRoot, consumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      fs.writeFileSync(consumerPath, 'type Secret = import("@/server/private").Secret;\n');
      expect(boundaryFails()).toBe(true);

      fs.writeFileSync(consumerPath, 'type SecretModule = typeof import("@/server/private");\n');
      expect(boundaryFails()).toBe(true);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("checks JSDoc import types without parsing ordinary comments", () => {
    const { fixtureRoot, consumerPath, jsConsumerPath, boundaryFails } = createBoundaryReviewFixture();
    try {
      fs.writeFileSync(consumerPath, "export const safe = 1;\n");
      fs.writeFileSync(
        jsConsumerPath,
        '/** @type {import("@/server/private").Secret} */\nexport const value = {};\n',
      );
      expect(boundaryFails()).toBe(true);

      fs.writeFileSync(
        jsConsumerPath,
        '/* Example: @type {import("@/server/private").Secret} */\nexport const value = {};\n',
      );
      expect(boundaryFails()).toBe(false);

      fs.writeFileSync(
        jsConsumerPath,
        '/** @import { Secret } from "@/server/private" */\nexport const value = {};\n',
      );
      expect(boundaryFails()).toBe(true);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

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

  it("ratchets root composition imports into legacy by exact edge", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-root-boundary-"));
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");
    try {
      fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
      fs.writeFileSync(path.join(fixtureRoot, "index.tsx"), 'import "./services/bootstrap";\n');
      fs.writeFileSync(path.join(fixtureRoot, "services/bootstrap.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
        JSON.stringify({ allowedFindings: [] }),
      );
      fs.writeFileSync(
        path.join(fixtureRoot, "config/legacy-import-baseline.json"),
        JSON.stringify({ version: 2, allowedImports: [] }),
      );

      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).toThrow(/modern-to-legacy-import/);

      fs.writeFileSync(
        path.join(fixtureRoot, "config/legacy-import-baseline.json"),
        JSON.stringify({
          version: 2,
          allowedImports: [{
            file: "index.tsx",
            specifier: "./services/bootstrap",
            target: "services/bootstrap",
          }],
        }),
      );
      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).not.toThrow();
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("allows the composition bootstrap only for the version 1 to version 2 transition", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-bootstrap-boundary-"));
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");
    const baselinePath = path.join(fixtureRoot, "config/legacy-import-baseline.json");
    const edge = {
      file: "index.tsx",
      specifier: "./services/incidentLogger",
      target: "services/incidentLogger",
    };
    const run = () => execFileSync(process.execPath, [boundaryScript], {
      cwd: fixtureRoot,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, LEGACY_IMPORT_BASELINE_REF: "HEAD" },
    });

    try {
      fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
      fs.writeFileSync(path.join(fixtureRoot, "index.tsx"), 'import "./services/incidentLogger";\n');
      fs.writeFileSync(path.join(fixtureRoot, "services/incidentLogger.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
        JSON.stringify({ allowedFindings: [] }),
      );
      fs.writeFileSync(baselinePath, JSON.stringify({ version: 1, allowedImports: [] }));
      execFileSync("git", ["init", "--quiet"], { cwd: fixtureRoot });
      execFileSync("git", ["add", "."], { cwd: fixtureRoot });
      execFileSync(
        "git",
        ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "v1"],
        { cwd: fixtureRoot },
      );

      fs.writeFileSync(baselinePath, JSON.stringify({ version: 2, allowedImports: [edge] }));
      expect(run).not.toThrow();

      fs.writeFileSync(baselinePath, JSON.stringify({ version: 2, allowedImports: [] }));
      execFileSync("git", ["add", "config/legacy-import-baseline.json"], { cwd: fixtureRoot });
      execFileSync(
        "git",
        ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "v2"],
        { cwd: fixtureRoot },
      );
      fs.writeFileSync(baselinePath, JSON.stringify({ version: 2, allowedImports: [edge] }));
      expect(run).toThrow(/Legacy import baseline se nesmí rozšiřovat/);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("treats types/index.ts as a protected modern root", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-types-boundary-"));
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");
    try {
      fs.mkdirSync(path.join(fixtureRoot, "types"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "server"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureRoot, "types/index.ts"),
        'export type { Legacy } from "@/services/legacy";\n',
      );
      fs.writeFileSync(path.join(fixtureRoot, "services/legacy.ts"), "export type Legacy = string;\n");
      fs.writeFileSync(path.join(fixtureRoot, "server/private.ts"), "export type Private = string;\n");
      fs.writeFileSync(
        path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
        JSON.stringify({ allowedFindings: [] }),
      );
      fs.writeFileSync(
        path.join(fixtureRoot, "config/legacy-import-baseline.json"),
        JSON.stringify({ version: 2, allowedImports: [] }),
      );

      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).toThrow(/modern-to-legacy-import/);

      fs.writeFileSync(
        path.join(fixtureRoot, "types/index.ts"),
        'export type { Private } from "@/server/private";\n',
      );
      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).toThrow(/forbidden-web-import/);

      fs.writeFileSync(path.join(fixtureRoot, "types/index.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(fixtureRoot, "config/runtime.ts"),
        "void window.electronAPI;\n",
      );
      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).toThrow(/renderer-bypass-platform-adapter/);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("discovers arbitrary root ambient declarations as modern entrypoints", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-ambient-boundary-"));
    const boundaryScript = path.join(ROOT, "scripts/check-boundaries.mjs");
    try {
      fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "ambient"), { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureRoot, "ambient/globals.d.ts"),
        'export type { Legacy } from "@/services/legacy";\n',
      );
      fs.writeFileSync(path.join(fixtureRoot, "services/legacy.ts"), "export type Legacy = string;\n");
      fs.writeFileSync(
        path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
        JSON.stringify({ allowedFindings: [] }),
      );
      fs.writeFileSync(
        path.join(fixtureRoot, "config/legacy-import-baseline.json"),
        JSON.stringify({ version: 2, allowedImports: [] }),
      );

      expect(() => execFileSync(process.execPath, [boundaryScript], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      })).toThrow(/modern-to-legacy-import/);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
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
