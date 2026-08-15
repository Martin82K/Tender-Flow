import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const boundaryScript = path.join(root, "scripts/check-boundaries.mjs");
const legacySpecifier = "@/services/exampleService";
const legacyTarget = "services/exampleService";

const createFixture = () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-imports-"));
  fs.mkdirSync(path.join(fixtureRoot, "app"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "services/exampleService.ts"),
    "export const exampleService = true;\n",
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
    JSON.stringify({ allowedFindings: [] }),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-import-baseline.json"),
    JSON.stringify({ version: 1, allowedImports: [] }),
  );
  return fixtureRoot;
};

const writeConsumer = (fixtureRoot: string, content: string) => {
  fs.writeFileSync(path.join(fixtureRoot, "app/consumer.ts"), content);
};

const writeBaseline = (
  fixtureRoot: string,
  allowedImports: Array<{ file: string; specifier: string; target: string }>,
) => {
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-import-baseline.json"),
    JSON.stringify({ version: 1, allowedImports }),
  );
};

const runBoundary = (cwd: string) =>
  spawnSync(process.execPath, [boundaryScript], {
    cwd,
    encoding: "utf8",
  });

describe("legacy import baseline guard", () => {
  it("rejects source symlinks inside modern roots", () => {
    const fixtureRoot = createFixture();
    fs.symlinkSync("../services/exampleService.ts", path.join(fixtureRoot, "app/linkedService.ts"));

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app/linkedService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects directory symlinks inside modern roots", () => {
    const fixtureRoot = createFixture();
    fs.symlinkSync("../services", path.join(fixtureRoot, "app/linked-services"));

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app/linked-services");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a symlink used as a modern scan root", () => {
    const fixtureRoot = createFixture();
    fs.rmSync(path.join(fixtureRoot, "app"), { recursive: true, force: true });
    fs.symlinkSync("services", path.join(fixtureRoot, "app"));

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects growing the baseline relative to the Git base revision", () => {
    const fixtureRoot = createFixture();
    writeConsumer(fixtureRoot, "export const modern = true;\n");
    const initialFiles = [
      "app/consumer.ts",
      "config/architecture-boundary-allowlist.json",
      "config/legacy-import-baseline.json",
      "services/exampleService.ts",
    ];
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot });
    spawnSync("git", ["add", "--", ...initialFiles], { cwd: fixtureRoot });
    const commit = spawnSync(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "baseline"],
      { cwd: fixtureRoot, encoding: "utf8" },
    );
    expect(commit.status).toBe(0);

    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );
    writeBaseline(fixtureRoot, [
      { file: "app/consumer.ts", specifier: legacySpecifier, target: legacyTarget },
    ]);

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Legacy import baseline se nesmí rozšiřovat");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a new modern-to-legacy import", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/consumer.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("accepts an exact baseline and rejects it after the import is removed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );
    writeBaseline(fixtureRoot, [
      {
        file: "app/consumer.ts",
        specifier: legacySpecifier,
        target: legacyTarget,
      },
    ]);

    try {
      const matchingResult = runBoundary(fixtureRoot);
      expect(matchingResult.status).toBe(0);

      writeConsumer(fixtureRoot, "export const modern = true;\n");
      const staleResult = runBoundary(fixtureRoot);
      expect(staleResult.status).toBe(1);
      expect(staleResult.stderr).toContain("Zastaralé legacy import výjimky");
      expect(staleResult.stderr).toContain("app/consumer.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
