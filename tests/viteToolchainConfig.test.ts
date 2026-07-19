import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const root = process.cwd();

describe("Vite toolchain configuration", () => {
  it("pins the reviewed Vite 8 toolchain in the manifest and lockfile", () => {
    const manifest = readJson<PackageManifest>(resolve(root, "package.json"));
    const lockfile = readJson<PackageLock>(resolve(root, "package-lock.json"));

    expect(manifest.devDependencies).toMatchObject({
      "@vitejs/plugin-react": "6.0.3",
      vite: "8.1.3",
    });
    expect(lockfile.packages?.["node_modules/@vitejs/plugin-react"]?.version).toBe(
      "6.0.3",
    );
    expect(lockfile.packages?.["node_modules/vite"]?.version).toBe("8.1.3");
  });

  it("uses Rolldown code splitting instead of removed object manualChunks", () => {
    const source = readFileSync(resolve(root, "vite.config.ts"), "utf8");

    expect(source).toContain("rolldownOptions");
    expect(source).toContain("codeSplitting");
    expect(source).not.toContain("rollupOptions");
    expect(source).not.toContain("manualChunks");

    for (const groupName of [
      "vendor-react",
      "vendor-supabase",
      "vendor-pdf",
      "vendor-excel",
      "vendor-charts",
      "vendor-utils",
    ]) {
      expect(source).toContain(`name: '${groupName}'`);
    }
  });
});
