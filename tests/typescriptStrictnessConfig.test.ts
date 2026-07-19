import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  devDependencies?: Record<string, string>;
};

type TypeScriptConfig = {
  compilerOptions?: Record<string, unknown>;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const root = process.cwd();

describe("TypeScript strictness configuration", () => {
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
      alwaysStrict: true,
      noImplicitThis: true,
      strictBindCallApply: true,
      strictFunctionTypes: true,
      strictNullChecks: true,
      useUnknownInCatchVariables: true,
    });
  });

  it("does not weaken noImplicitAny for the desktop process", () => {
    const config = readJson<TypeScriptConfig>(
      resolve(root, "desktop/tsconfig.json"),
    );

    expect(config.compilerOptions).toMatchObject({
      noImplicitAny: true,
    });
  });
});
