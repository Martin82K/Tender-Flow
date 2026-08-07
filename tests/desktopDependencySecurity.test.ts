import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string | Record<string, string>>;
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
    expect(manifest.dependencies?.["electron-updater"]).toBe("6.8.9");
    expect(manifest.overrides).toEqual({
      "brace-expansion": "5.0.9",
      "electron-updater": {
        "js-yaml": "4.3.1",
      },
      exceljs: {
        tmp: "0.2.7",
        uuid: "11.1.1",
      },
    });
  });

  it.each([
    ["node_modules/brace-expansion", "5.0.9"],
    ["node_modules/builder-util-runtime", "9.7.0"],
    ["node_modules/electron-updater", "6.8.9"],
    ["node_modules/js-yaml", "4.3.1"],
    ["node_modules/tmp", "0.2.7"],
    ["node_modules/uuid", "11.1.1"],
  ])("resolves %s to patched version %s", (packagePath, expectedVersion) => {
    expect(lockfile.packages?.[packagePath]?.version).toBe(expectedVersion);
  });
});
