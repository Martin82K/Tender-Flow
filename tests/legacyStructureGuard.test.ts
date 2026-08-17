import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const guardScript = path.join(root, "scripts/check-legacy-structure.mjs");

const createFixture = (allowedFiles: string[], trackedFiles: string[]) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-structure-"));
  fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-freeze.json"),
    JSON.stringify({
      version: 1,
      frozenRoots: ["components"],
      allowedFiles,
    }),
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
});
