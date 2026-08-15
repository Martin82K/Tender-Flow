import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = process.cwd();
const configPath = path.join(root, "config", "legacy-freeze.json");

if (!fs.existsSync(configPath)) {
  console.error("Chybí config/legacy-freeze.json");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const frozenRoots = Array.isArray(config.frozenRoots) ? config.frozenRoots : [];
const allowedFiles = Array.isArray(config.allowedFiles) ? config.allowedFiles : [];

const isSafeRepoPath = (value) => {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) return false;
  const normalized = value.replace(/\\/g, "/");
  return (
    /^[A-Za-z0-9._/-]+$/.test(normalized) &&
    normalized !== ".." &&
    !normalized.startsWith("../") &&
    !normalized.includes("/../")
  );
};

if (frozenRoots.length === 0) {
  console.error("legacy-freeze.json neobsahuje frozenRoots");
  process.exit(1);
}

if (!frozenRoots.every(isSafeRepoPath) || !allowedFiles.every(isSafeRepoPath)) {
  console.error("legacy-freeze.json obsahuje neplatnou nebo nebezpečnou cestu.");
  process.exit(1);
}

const duplicateAllowedFiles = allowedFiles.filter(
  (file, index) => allowedFiles.indexOf(file) !== index,
);
if (duplicateAllowedFiles.length > 0) {
  console.error("legacy-freeze.json obsahuje duplicitní allowedFiles:");
  for (const file of [...new Set(duplicateAllowedFiles)].sort()) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const outsideFrozenRoots = allowedFiles.filter(
  (file) => !frozenRoots.some((rootPath) => file === rootPath || file.startsWith(`${rootPath}/`)),
);
if (outsideFrozenRoots.length > 0) {
  console.error("legacy-freeze.json obsahuje allowedFiles mimo frozenRoots:");
  for (const file of outsideFrozenRoots.sort()) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const allowed = new Set(allowedFiles);

let tracked = "";
try {
  tracked = execFileSync("git", ["ls-files", "--", ...frozenRoots], {
    cwd: root,
    encoding: "utf8",
  });
} catch (error) {
  console.error("Nepodařilo se načíst git ls-files pro frozen roots.");
  process.exit(1);
}

const trackedFiles = tracked
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .sort();

const unexpected = trackedFiles.filter((file) => !allowed.has(file));
const trackedSet = new Set(trackedFiles);
const stale = allowedFiles.filter((file) => !trackedSet.has(file)).sort();

if (unexpected.length > 0 || stale.length > 0) {
  if (unexpected.length > 0) {
    console.error("Legacy structure check selhal. Nové soubory ve frozen roots:");
    for (const file of unexpected) {
      console.error(`- ${file}`);
    }
  }
  if (stale.length > 0) {
    if (unexpected.length > 0) console.error("");
    console.error("Zastaralé výjimky v legacy-freeze.json:");
    for (const file of stale) {
      console.error(`- ${file}`);
    }
  }
  console.error("\nAktualizuj config/legacy-freeze.json tak, aby byl přesným snapshotem tracked souborů.");
  process.exit(1);
}

console.log(`Legacy structure check OK (${trackedFiles.length} souborů ve frozen roots).`);
