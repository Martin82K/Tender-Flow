import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
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
    expect(manifest.dependencies?.["@modelcontextprotocol/server"]).toBe("2.0.0");
    expect(manifest.dependencies?.["@modelcontextprotocol/sdk"]).toBeUndefined();
    expect(manifest.dependencies?.dompurify).toBe("3.4.13");
    expect(manifest.dependencies?.express).toBe("^4.22.2");
    expect(manifest.dependencies?.fflate).toBe("0.8.3");
    expect(manifest.dependencies?.["posthog-js"]).toBeUndefined();
    expect(manifest.devDependencies?.["@vitejs/plugin-react"]).toBe("6.0.3");
    expect(manifest.devDependencies?.electron).toBe("^43.3.0");
    expect(manifest.devDependencies?.["electron-builder"]).toBe("^26.15.3");
    expect(manifest.devDependencies?.vite).toBe("8.1.3");
    expect(manifest.devDependencies?.vitest).toBe("4.1.0");
  });

  it("pins patched transitive dependencies", () => {
    expect(manifest.overrides).toEqual({
      "@modelcontextprotocol/sdk": {
        express: {
          "body-parser": "2.3.0",
        },
      },
      "@hono/node-server": "2.1.0",
      axios: "1.19.0",
      "electron-builder": {
        "js-yaml": "4.3.1",
      },
      "es-module-lexer": "2.1.0",
      exceljs: {
        uuid: "11.1.1",
      },
      "fast-uri": "3.1.7",
      "form-data": "4.0.6",
      hono: "4.13.0",
      "ip-address": "10.4.0",
      joi: "18.2.1",
      qs: "6.16.0",
      sharp: "0.35.3",
      "std-env": "4.1.0",
      tar: "7.5.22",
      tmp: "0.2.7",
      ws: "8.21.0",
    });
  });

  it.each([
    ["node_modules/@humanfs/node", "0.16.8"],
    ["node_modules/@xmldom/xmldom", "0.8.15"],
    ["node_modules/@hono/node-server", "2.1.0"],
    ["node_modules/@modelcontextprotocol/core", "2.0.0"],
    ["node_modules/@modelcontextprotocol/server", "2.0.0"],
    ["node_modules/@modelcontextprotocol/sdk", "1.30.0"],
    ["node_modules/@modelcontextprotocol/sdk/node_modules/body-parser", "2.3.0"],
    ["node_modules/@vitejs/plugin-react", "6.0.3"],
    ["node_modules/axios", "1.19.0"],
    ["node_modules/body-parser", "1.20.6"],
    ["node_modules/brace-expansion", "5.0.9"],
    ["node_modules/@electron/universal/node_modules/brace-expansion", "2.1.4"],
    ["node_modules/filelist/node_modules/brace-expansion", "2.1.4"],
    ["node_modules/minimatch/node_modules/brace-expansion", "1.1.18"],
    ["node_modules/readdir-glob/node_modules/brace-expansion", "2.1.4"],
    ["node_modules/builder-util-runtime", "9.7.0"],
    ["node_modules/dompurify", "3.4.13"],
    ["node_modules/electron", "43.3.0"],
    ["node_modules/electron-builder", "26.15.3"],
    ["node_modules/fast-uri", "3.1.7"],
    ["node_modules/vitest/node_modules/es-module-lexer", "2.1.0"],
    ["node_modules/form-data", "4.0.6"],
    ["node_modules/hono", "4.13.0"],
    ["node_modules/ip-address", "10.4.0"],
    ["node_modules/joi", "18.2.1"],
    ["node_modules/js-yaml", "4.3.1"],
    ["node_modules/fflate", "0.8.3"],
    ["node_modules/postcss", "8.5.26"],
    ["node_modules/qs", "6.16.0"],
    ["node_modules/sharp", "0.35.3"],
    ["node_modules/shell-quote", "1.9.0"],
    ["node_modules/vitest/node_modules/std-env", "4.1.0"],
    ["node_modules/tar", "7.5.22"],
    ["node_modules/tmp", "0.2.7"],
    ["node_modules/uuid", "11.1.1"],
    ["node_modules/vite", "8.1.3"],
    ["node_modules/vitest", "4.1.0"],
    ["node_modules/ws", "8.21.0"],
  ])("resolves %s to patched version %s", (packagePath, expectedVersion) => {
    expect(lockfile.packages?.[packagePath]?.version).toBe(expectedVersion);
  });

  it("does not retain the removed analytics SDK or its transitive packages", () => {
    expect(Object.keys(lockfile.packages ?? {}).filter((path) => /(?:posthog|node_modules\/fflate$)/.test(path))).toEqual(["node_modules/fflate"]);
  });

  it("does not retain the removed Babel-based React transform", () => {
    expect(lockfile.packages?.["node_modules/@babel/core"]).toBeUndefined();
  });
});
