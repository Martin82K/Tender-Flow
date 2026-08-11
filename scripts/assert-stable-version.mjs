#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateStableReleaseVersions } from "./assert-stable-version-core.js";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(scriptsDir, "..");
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"),
);
const appVersionSource = readFileSync(
  join(repositoryRoot, "config/version.ts"),
  "utf8",
);
const appVersion = appVersionSource.match(
  /^export const APP_VERSION = ["']([^"']+)["'];?$/m,
)?.[1];

const errors = validateStableReleaseVersions({
  packageVersion: packageJson.version,
  lockfileVersion: packageLock.version,
  lockfileRootVersion: packageLock.packages?.[""]?.version,
  appVersion,
});

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Stable release version verified: ${packageJson.version}`);
