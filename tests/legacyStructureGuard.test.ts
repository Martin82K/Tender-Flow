import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const guardScript = path.join(root, "scripts/check-legacy-structure.mjs");
const canonicalRoots = ["components", "hooks", "services", "context", "utils"];
const createMigrationPlan = (finalCloseout: boolean) => {
  const baselineDebt = {
    fingerprint: `sha256:${"f".repeat(64)}`,
    metrics: {
      legacyNodes: 15,
      modernToLegacyImports: 0,
      legacyInternalImports: 0,
      cyclicComponents: 0,
    },
  };
  return {
    version: 2,
    baselineDebt,
    loops: Array.from({ length: 16 }, (_, index) => {
      const legacyNodes = 15 - index;
      return {
        id: `loop-${String(index + 1).padStart(2, "0")}`,
        title: `Loop ${index + 1}`,
        status: finalCloseout ? "complete" : index === 0 ? "in_progress" : "planned",
        objective: "Ověřit migrační krok.",
        dependencies: index === 0 ? [] : [`loop-${String(index).padStart(2, "0")}`],
        exitCriteria: ["Legacy dluh je změřen."],
        riskChecks: ["Bezpečnostní review."],
        testGates: ["Focused testy."],
        ...(finalCloseout
          ? {
              completionEvidence: {
                fingerprint: `sha256:${String(index + 1).padStart(64, "0")}`,
                metrics: { ...baselineDebt.metrics, legacyNodes },
              },
            }
          : {}),
      };
    }),
  };
};

const createFixture = (
  allowedFiles: string[],
  trackedFiles: string[],
  { finalCloseout = false, frozenRoots = canonicalRoots } = {},
) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-structure-"));
  fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-freeze.json"),
    JSON.stringify({
      version: 1,
      frozenRoots,
      allowedFiles,
    }),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/architecture-migration-plan.json"),
    JSON.stringify(createMigrationPlan(finalCloseout)),
  );

  execFileSync("git", ["init", "--quiet"], { cwd: fixtureRoot });
  for (const file of trackedFiles) {
    const absolutePath = path.join(fixtureRoot, file);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, "export const value = true;\n");
  }
  if (trackedFiles.length > 0) {
    execFileSync("git", ["add", "--", ...trackedFiles], { cwd: fixtureRoot });
  }

  return fixtureRoot;
};

const runGuard = (cwd: string) =>
  spawnSync(process.execPath, [guardScript], {
    cwd,
    encoding: "utf8",
  });

describe("legacy structure guard", () => {
  it("rejects Git pathspec magic in frozen roots", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-pathspec-"));
    fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "config/legacy-freeze.json"),
      JSON.stringify({
        version: 1,
        frozenRoots: [":(exclude)**"],
        allowedFiles: [],
      }),
    );
    fs.writeFileSync(
      path.join(fixtureRoot, "config/architecture-migration-plan.json"),
      JSON.stringify({ version: 2, loops: [] }),
    );
    execFileSync("git", ["init", "--quiet"], { cwd: fixtureRoot });

    try {
      const result = runGuard(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("neplatnou nebo nebezpečnou cestu");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects stale freeze entries for files that are no longer tracked", () => {
    const fixtureRoot = createFixture(
      ["components/existing.ts", "components/removed.ts"],
      ["components/existing.ts"],
    );

    try {
      const result = runGuard(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Zastaralé výjimky v legacy-freeze.json");
      expect(result.stderr).toContain("- components/removed.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("accepts an exact freeze snapshot", () => {
    const fixtureRoot = createFixture(
      ["components/existing.ts"],
      ["components/existing.ts"],
    );

    try {
      const result = runGuard(fixtureRoot);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Legacy structure check OK (1 souborů ve frozen roots).");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects noncanonical frozen roots", () => {
    const fixtureRoot = createFixture([], [], { frozenRoots: ["app"] });
    try {
      const result = runGuard(fixtureRoot);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("kanonické frozenRoots");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("requires absent legacy roots and an empty snapshot at final closeout", () => {
    const fixtureRoot = createFixture(["components/legacy.ts"], ["components/legacy.ts"], {
      finalCloseout: true,
    });
    try {
      const withAllowedFile = runGuard(fixtureRoot);
      expect(withAllowedFile.status).toBe(1);
      expect(withAllowedFile.stderr).toContain("loop-16 vyžaduje prázdné allowedFiles");

      fs.writeFileSync(
        path.join(fixtureRoot, "config/legacy-freeze.json"),
        JSON.stringify({ version: 1, frozenRoots: canonicalRoots, allowedFiles: [] }),
      );
      fs.rmSync(path.join(fixtureRoot, "components/legacy.ts"));
      const withDirectory = runGuard(fixtureRoot);
      expect(withDirectory.status).toBe(1);
      expect(withDirectory.stderr).toContain("Legacy root stále existuje: components");

      fs.rmSync(path.join(fixtureRoot, "components"), { recursive: true, force: true });
      execFileSync("git", ["add", "-u", "--", "components"], { cwd: fixtureRoot });
      const clean = runGuard(fixtureRoot);
      expect(clean.status).toBe(0);
      expect(clean.stdout).toContain("Legacy structure check OK (0 souborů");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a malformed status sequence instead of skipping loop-16 closeout", () => {
    const fixtureRoot = createFixture([], []);
    try {
      const plan = createMigrationPlan(true);
      plan.loops[0].status = "planned";
      delete plan.loops[0].completionEvidence;
      fs.writeFileSync(
        path.join(fixtureRoot, "config/architecture-migration-plan.json"),
        JSON.stringify(plan),
      );

      const result = runGuard(fixtureRoot);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Stavy smyček musí postupovat");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects an untracked non-source file in a legacy root at final closeout", () => {
    const fixtureRoot = createFixture([], [], { finalCloseout: true });
    try {
      fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
      fs.writeFileSync(path.join(fixtureRoot, "services/README.md"), "legacy\n");

      const result = runGuard(fixtureRoot);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Legacy root stále existuje: services");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a symlink used as a legacy root at final closeout", () => {
    const fixtureRoot = createFixture([], [], { finalCloseout: true });
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-target-"));
    try {
      fs.symlinkSync(target, path.join(fixtureRoot, "services"), "dir");

      const result = runGuard(fixtureRoot);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Legacy root stále existuje: services");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
