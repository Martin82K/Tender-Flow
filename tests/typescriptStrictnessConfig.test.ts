import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

type TypeScriptConfig = {
  compilerOptions?: Record<string, unknown>;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const root = process.cwd();

describe("TypeScript strictness configuration", () => {
  it("keeps the compiler on the supported TypeScript 6.0 line", () => {
    const manifest = readJson<PackageManifest>(resolve(root, "package.json"));
    const lockfile = readJson<PackageLock>(resolve(root, "package-lock.json"));

    expect(manifest.devDependencies?.typescript).toMatch(/^~6\.0\.\d+$/);
    expect(lockfile.packages?.["node_modules/typescript"]?.version).toMatch(
      /^6\.0\.\d+$/,
    );
  });

  it("declares React type packages directly", () => {
    const manifest = readJson<PackageManifest>(resolve(root, "package.json"));

    expect(manifest.devDependencies).toMatchObject({
      "@types/react": expect.any(String),
      "@types/react-dom": expect.any(String),
    });
  });

  it("enables the strict checks adopted by the web application", () => {
    const config = readJson<TypeScriptConfig>(resolve(root, "tsconfig.json"));

    expect(config.compilerOptions).toMatchObject({
      strict: true,
      alwaysStrict: true,
      noImplicitAny: true,
      noImplicitThis: true,
      strictBindCallApply: true,
      strictFunctionTypes: true,
      strictNullChecks: true,
      strictPropertyInitialization: true,
      useUnknownInCatchVariables: true,
    });
  });

  it("uses explicit path aliases without the deprecated baseUrl option", () => {
    const config = readJson<TypeScriptConfig>(resolve(root, "tsconfig.json"));
    const paths = config.compilerOptions?.paths as
      | Record<string, string[]>
      | undefined;

    expect(config.compilerOptions?.baseUrl).toBeUndefined();
    expect(paths).toBeDefined();
    expect(
      Object.values(paths ?? {})
        .flat()
        .every((path) => path.startsWith("./")),
    ).toBe(true);
  });

  it("does not weaken noImplicitAny for the desktop process", () => {
    const config = readJson<TypeScriptConfig>(
      resolve(root, "desktop/tsconfig.json"),
    );

    expect(config.compilerOptions).toMatchObject({
      noImplicitAny: true,
    });
  });

  it("uses modern Node module resolution for the desktop CommonJS process", () => {
    const config = readJson<TypeScriptConfig>(
      resolve(root, "desktop/tsconfig.json"),
    );

    expect(config.compilerOptions).toMatchObject({
      module: "Node16",
      moduleResolution: "Node16",
    });
  });
});
