import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createSha512Base64,
  verifyReleaseArtifacts,
} from "../scripts/verify-release-artifacts-core.js";

const createFixtureDir = () => mkdtempSync(join(tmpdir(), "tender-flow-release-"));

const writeLatestYml = (dir: string, content: string) => {
  writeFileSync(join(dir, "latest.yml"), content, "utf-8");
};

describe("release artifact verification", () => {
  it("accepts a Windows latest.yml that matches the referenced installer", () => {
    const dir = createFixtureDir();

    try {
      const installerPath = join(dir, "Tender-Flow-Setup-1.8.2.exe");
      writeFileSync(installerPath, "fixture installer");
      const sha512 = createSha512Base64(installerPath);

      writeLatestYml(
        dir,
        [
          "version: 1.8.2",
          "files:",
          "  - url: Tender-Flow-Setup-1.8.2.exe",
          `    sha512: ${sha512}`,
          "    size: 17",
          "path: Tender-Flow-Setup-1.8.2.exe",
          `sha512: ${sha512}`,
          "releaseDate: '2026-06-03T08:18:55.000Z'",
          "",
        ].join("\n"),
      );

      expect(verifyReleaseArtifacts({ dir, version: "1.8.2" })).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a release output without latest.yml", () => {
    const dir = createFixtureDir();

    try {
      const errors = verifyReleaseArtifacts({ dir, version: "1.8.2" });

      expect(errors).toContain(`Missing ${join(dir, "latest.yml")}. Windows auto-update will fail with GitHub 404.`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects metadata when sha512 does not match the installer", () => {
    const dir = createFixtureDir();

    try {
      writeFileSync(join(dir, "Tender-Flow-Setup-1.8.2.exe"), "fixture installer");
      writeLatestYml(
        dir,
        [
          "version: 1.8.2",
          "files:",
          "  - url: Tender-Flow-Setup-1.8.2.exe",
          "    sha512: invalid",
          "    size: 17",
          "path: Tender-Flow-Setup-1.8.2.exe",
          "sha512: invalid",
          "",
        ].join("\n"),
      );

      expect(verifyReleaseArtifacts({ dir, version: "1.8.2" })).toContain(
        "latest.yml sha512 does not match the referenced installer.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
