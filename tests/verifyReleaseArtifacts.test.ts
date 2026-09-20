import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

it('verifies beta metadata separately from the stable latest channel',()=>{
 const dir=createFixtureDir();
 try{
  const version='1.9.39-beta.1',name=`Tender-Flow-Setup-${version}.exe`,path=join(dir,name);
  writeFileSync(path,'fixture installer');const hash=createSha512Base64(path);
  const metadata=`version: ${version}\nfiles:\n  - url: ${name}\n    sha512: ${hash}\n    size: 17\npath: ${name}\nsha512: ${hash}\n`;
  writeLatestYml(dir,metadata);
  expect(verifyReleaseArtifacts({dir,version})).toContain(`Missing ${join(dir,'beta.yml')}. Windows auto-update will fail with GitHub 404.`);
  writeFileSync(join(dir,'beta.yml'),metadata);
  expect(verifyReleaseArtifacts({dir,version})).toEqual([]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
