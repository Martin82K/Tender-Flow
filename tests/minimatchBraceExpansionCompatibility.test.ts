import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

type MinimatchModule =
  | ((path: string, pattern: string) => boolean)
  | { minimatch: (path: string, pattern: string) => boolean };

type PackageManifest = {
  name?: string;
  version?: string;
};

const installations = [
  ["minimatch 3", "node_modules/minimatch", "1.1.18"],
  ["filelist minimatch 5", "node_modules/filelist/node_modules/minimatch", "2.1.4"],
  ["readdir-glob minimatch 5", "node_modules/readdir-glob/node_modules/minimatch", "2.1.4"],
  ["glob minimatch 9.0.8", "node_modules/glob/node_modules/minimatch", "5.0.9"],
  [
    "@electron/universal minimatch 9.0.9",
    "node_modules/@electron/universal/node_modules/minimatch",
    "2.1.4",
  ],
  [
    "app-builder-lib minimatch 10",
    "node_modules/app-builder-lib/node_modules/minimatch",
    "5.0.9",
  ],
] as const;

const readManifest = (path: string): PackageManifest =>
  JSON.parse(readFileSync(path, "utf8")) as PackageManifest;

const findPackageManifest = (entryPath: string, packageName: string): PackageManifest => {
  let directory = dirname(entryPath);

  while (directory !== dirname(directory)) {
    const manifestPath = join(directory, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = readManifest(manifestPath);
      if (manifest.name === packageName) return manifest;
    }
    directory = dirname(directory);
  }

  throw new Error(`Could not locate ${packageName} package.json from ${entryPath}`);
};

describe("minimatch brace-expansion compatibility", () => {
  it.each(installations)(
    "%s resolves a compatible patched brace-expansion",
    (_label, relativePath, expectedBraceExpansionVersion) => {
      const minimatchPath = join(process.cwd(), relativePath);
      const requireFromMinimatch = createRequire(join(minimatchPath, "package.json"));
      const loaded = requireFromMinimatch(minimatchPath) as MinimatchModule;
      const minimatch = typeof loaded === "function" ? loaded : loaded.minimatch;
      const braceExpansionEntry = requireFromMinimatch.resolve("brace-expansion");
      const braceExpansionManifest = findPackageManifest(
        braceExpansionEntry,
        "brace-expansion",
      );

      expect(braceExpansionManifest.version).toBe(expectedBraceExpansionVersion);
      expect(minimatch("src/example.ts", "src/*.{ts,tsx}")).toBe(true);
      expect(minimatch("src/example.js", "src/*.{ts,tsx}")).toBe(false);
    },
  );
});
