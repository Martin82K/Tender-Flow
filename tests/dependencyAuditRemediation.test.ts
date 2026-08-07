import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

const readLockfile = (path: string): PackageLock =>
  JSON.parse(readFileSync(path, "utf8")) as PackageLock;

const parseVersion = (version: string): [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version
    .split("-", 1)[0]
    .split(".")
    .map(Number);
  return [major, minor, patch];
};

const isAtLeast = (version: string, minimum: string): boolean => {
  const current = parseVersion(version);
  const required = parseVersion(minimum);

  for (const index of [0, 1, 2]) {
    if (current[index] === required[index]) continue;
    return current[index] > required[index];
  }

  return true;
};

const expectPatchedVersion = (
  lockfile: PackageLock,
  packagePath: string,
  minimum: string,
): void => {
  const version = lockfile.packages?.[packagePath]?.version;
  expect(version, `missing ${packagePath}`).toBeTypeOf("string");
  expect(
    isAtLeast(version ?? "0.0.0", minimum),
    `${packagePath}@${version} must be >= ${minimum}`,
  ).toBe(true);
};

describe("dependency audit remediation", () => {
  const root = process.cwd();
  const rootLockfile = readLockfile(join(root, "package-lock.json"));
  const desktopLockfile = readLockfile(join(root, "desktop/package-lock.json"));

  it.each([
    ["node_modules/@hono/node-server", "2.0.5"],
    ["node_modules/dompurify", "3.4.12"],
    ["node_modules/electron", "42.0.0"],
    ["node_modules/electron-builder", "26.15.0"],
    ["node_modules/builder-util-runtime", "9.7.0"],
    ["node_modules/axios", "1.18.0"],
    ["node_modules/body-parser", "1.20.6"],
    ["node_modules/@modelcontextprotocol/sdk/node_modules/body-parser", "2.3.0"],
    ["node_modules/brace-expansion", "5.0.9"],
    ["node_modules/fast-uri", "3.1.5"],
    ["node_modules/hono", "4.12.34"],
    ["node_modules/ip-address", "10.4.0"],
    ["node_modules/js-yaml", "4.3.1"],
    ["node_modules/postcss", "8.5.23"],
    ["node_modules/sharp", "0.35.0"],
    ["node_modules/shell-quote", "1.9.0"],
    ["node_modules/tar", "7.5.22"],
  ])("resolves root %s outside the vulnerable range", (packagePath, minimum) => {
    expectPatchedVersion(rootLockfile, packagePath, minimum);
  });

  it.each([
    ["node_modules/electron-updater", "6.8.9"],
    ["node_modules/builder-util-runtime", "9.7.0"],
    ["node_modules/brace-expansion", "5.0.9"],
    ["node_modules/js-yaml", "4.3.1"],
  ])("resolves desktop %s outside the vulnerable range", (packagePath, minimum) => {
    expectPatchedVersion(desktopLockfile, packagePath, minimum);
  });
});
