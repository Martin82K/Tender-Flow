import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string | Record<string, string>>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

describe("root dependency security versions", () => {
  const root = process.cwd();
  const manifest = readJson<PackageManifest>(join(root, "package.json"));
  const lockfile = readJson<PackageLock>(join(root, "package-lock.json"));

  it("pins patched direct dependencies", () => {
    expect(manifest.dependencies?.dompurify).toBe("3.4.11");
    expect(manifest.dependencies?.["posthog-js"]).toBe("1.379.1");
    expect(manifest.devDependencies?.["@vitejs/plugin-react"]).toBe("6.0.3");
    expect(manifest.devDependencies?.["electron-builder"]).toBe("26.15.3");
    expect(manifest.devDependencies?.vite).toBe("8.1.3");
    expect(manifest.devDependencies?.vitest).toBe("4.1.0");
  });

  it("pins patched transitive dependencies", () => {
    expect(manifest.overrides).toEqual({
      axios: "1.18.1",
      "brace-expansion": "5.0.7",
      concurrently: {
        "shell-quote": "1.9.0",
      },
      "electron-builder": {
        "js-yaml": "4.3.0",
      },
      "es-module-lexer": "2.1.0",
      exceljs: {
        uuid: "11.1.1",
      },
      "fast-uri": "3.1.4",
      "form-data": "4.0.6",
      hono: "4.12.25",
      joi: "18.2.1",
      qs: "6.15.2",
      "std-env": "4.1.0",
      tar: "7.5.19",
      tmp: "0.2.7",
      ws: "8.21.0",
    });
  });

  it.each([
    ["node_modules/@vitejs/plugin-react", "6.0.3"],
    ["node_modules/axios", "1.18.1"],
    ["node_modules/brace-expansion", "5.0.7"],
    ["node_modules/dompurify", "3.4.11"],
    ["node_modules/vitest/node_modules/es-module-lexer", "2.1.0"],
    ["node_modules/form-data", "4.0.6"],
    ["node_modules/hono", "4.12.25"],
    ["node_modules/joi", "18.2.1"],
    ["node_modules/electron-builder", "26.15.3"],
    ["node_modules/fast-uri", "3.1.4"],
    ["node_modules/js-yaml", "4.3.0"],
    ["node_modules/posthog-js", "1.379.1"],
    ["node_modules/qs", "6.15.2"],
    ["node_modules/shell-quote", "1.9.0"],
    ["node_modules/vitest/node_modules/std-env", "4.1.0"],
    ["node_modules/tar", "7.5.19"],
    ["node_modules/tmp", "0.2.7"],
    ["node_modules/uuid", "11.1.1"],
    ["node_modules/vite", "8.1.3"],
    ["node_modules/vitest", "4.1.0"],
    ["node_modules/ws", "8.21.0"],
  ])("resolves %s to patched version %s", (packagePath, expectedVersion) => {
    expect(lockfile.packages?.[packagePath]?.version).toBe(expectedVersion);
  });

  it("does not retain the removed Babel-based React transform", () => {
    expect(lockfile.packages?.["node_modules/@babel/core"]).toBeUndefined();
  });
});
