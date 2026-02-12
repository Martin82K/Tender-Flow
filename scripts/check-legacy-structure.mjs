import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = process.cwd();
const configPath = path.join(root, "config", "legacy-freeze.json");

if (!fs.existsSync(configPath)) {
  console.error("Chybí config/legacy-freeze.json");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const frozenRoots = Array.isArray(config.frozenRoots) ? config.frozenRoots : [];
const allowed = new Set(Array.isArray(config.allowedFiles) ? config.allowedFiles : []);

if (frozenRoots.length === 0) {
  console.error("legacy-freeze.json neobsahuje frozenRoots");
  process.exit(1);
}

let tracked = "";
try {
  tracked = execSync(`git ls-files -- ${frozenRoots.join(" ")}`, { encoding: "utf8" });
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

if (unexpected.length > 0) {
  console.error("Legacy structure check selhal. Nové soubory ve frozen roots:");
  for (const file of unexpected) {
    console.error(`- ${file}`);
  }
  console.error("\nPokud je přidání záměrné, aktualizuj config/legacy-freeze.json.");
  process.exit(1);
}

console.log(`Legacy structure check OK (${trackedFiles.length} souborů ve frozen roots).`);
