import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopOutput = path.join(repositoryRoot, "desktop", "dist");

if (path.relative(repositoryRoot, desktopOutput) !== path.join("desktop", "dist")) {
  throw new Error("Refusing to clean an unexpected desktop output path.");
}

fs.rmSync(desktopOutput, { recursive: true, force: true });
console.log("Cleaned generated desktop/dist output.");
