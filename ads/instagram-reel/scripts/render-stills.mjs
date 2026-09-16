#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const stillsDir = join(projectRoot, "out", "stills");
mkdirSync(stillsDir, { recursive: true });

const posters = [
  { name: "01-kategorie", frame: 24 },
  { name: "02-oslovení", frame: 96 },
  { name: "03-kola", frame: 186 },
  { name: "04-vyber", frame: 288 },
  { name: "05-smlouva", frame: 405 },
];

for (const poster of posters) {
  const output = join(stillsDir, `${poster.name}.png`);
  const remotionBin = join(projectRoot, "node_modules", ".bin", "remotion");
  const result = spawnSync(
    remotionBin,
    ["still", "src/index.ts", "TenderFlowReel15", output, `--frame=${poster.frame}`],
    { cwd: projectRoot, stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
