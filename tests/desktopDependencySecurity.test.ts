import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  overrides?: Record<string, Record<string, string>>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

describe("desktop dependency security overrides", () => {
  const desktopRoot = join(process.cwd(), "desktop");
  const manifest = readJson<PackageManifest>(join(desktopRoot, "package.json"));
  const lockfile = readJson<PackageLock>(join(desktopRoot, "package-lock.json"));

  it("pins patched transitive versions at their owning dependencies", () => {
    expect(manifest.overrides).toEqual({
      "electron-updater": {
        "js-yaml": "4.2.0",
      },
      exceljs: {
        tmp: "0.2.7",
        uuid: "11.1.1",
      },
    });
  });

  it.each([
    ["node_modules/js-yaml", "4.2.0"],
    ["node_modules/tmp", "0.2.7"],
    ["node_modules/uuid", "11.1.1"],
  ])("resolves %s to patched version %s", (packagePath, expectedVersion) => {
    expect(lockfile.packages?.[packagePath]?.version).toBe(expectedVersion);
  });
});
