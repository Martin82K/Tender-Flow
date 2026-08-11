import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateStableReleaseVersions,
  validateStableVersion,
} from "../scripts/assert-stable-version-core.js";

describe("stable desktop release version validation", () => {
  it("accepts a stable semantic version", () => {
    expect(validateStableVersion("1.9.0")).toEqual([]);
  });

  it.each(["1.9.0-beta.18", "1.9.0-rc.1", "1.9.0-alpha.2"])(
    "rejects prerelease version %s",
    (version) => {
      expect(validateStableVersion(version)).toContain(
        `Stable release requires a stable version, received ${version}.`,
      );
    },
  );

  it.each(["", "1.9", "v1.9.0", "1.9.0+build.1"])(
    "rejects unsupported version %s",
    (version) => {
      expect(validateStableVersion(version).length).toBeGreaterThan(0);
    },
  );

  it("accepts synchronized stable release metadata", () => {
    expect(
      validateStableReleaseVersions({
        packageVersion: "1.9.0",
        lockfileVersion: "1.9.0",
        lockfileRootVersion: "1.9.0",
        appVersion: "1.9.0",
      }),
    ).toEqual([]);
  });

  it.each([
    ["lockfileVersion", "package-lock"],
    ["lockfileRootVersion", "package-lock root package"],
    ["appVersion", "APP_VERSION"],
  ] as const)("rejects version drift in %s", (key, label) => {
    const versions = {
      packageVersion: "1.9.0",
      lockfileVersion: "1.9.0",
      lockfileRootVersion: "1.9.0",
      appVersion: "1.9.0",
    };
    versions[key] = "1.9.0-beta.18";

    expect(validateStableReleaseVersions(versions)).toContain(
      `Version mismatch: ${label} is 1.9.0-beta.18, expected 1.9.0.`,
    );
  });

  it("keeps generic desktop builds prerelease-compatible and gates only stable preparation", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["desktop:build:mac"]).not.toContain(
      "assert-stable-version",
    );
    expect(packageJson.scripts["desktop:build:win"]).not.toContain(
      "assert-stable-version",
    );
    expect(packageJson.scripts["release:prepare:stable"]).toContain(
      "release:assert-stable-version",
    );
  });
});
