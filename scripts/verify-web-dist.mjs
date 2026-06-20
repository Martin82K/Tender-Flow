#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const requiredFiles = [
  "index.html",
  "terms/index.html",
  "privacy/index.html",
  "cookies/index.html",
  "dpa/index.html",
  "imprint/index.html",
];

const forbiddenSecretPatterns = [
  {
    name: "Supabase service role JWT",
    pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    isAllowed: (value) => {
      const [, payload] = value.split(".");
      if (!payload) return true;

      try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return decoded.role !== "service_role";
      } catch {
        return true;
      }
    },
  },
  {
    name: "service role marker",
    pattern: /service[_-]?role/gi,
  },
  {
    name: "private key marker",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "OpenAI API key",
    pattern: /sk-(?:proj-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/g,
  },
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".txt",
  ".webmanifest",
  ".xml",
]);

const fail = (message) => {
  console.error(`[verify-web-dist] ${message}`);
  process.exitCode = 1;
};

const fileExists = async (relativePath) => {
  try {
    const stats = await fs.stat(path.join(distDir, relativePath));
    return stats.isFile();
  } catch {
    return false;
  }
};

const collectFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const verifyRequiredFiles = async () => {
  for (const requiredFile of requiredFiles) {
    if (!await fileExists(requiredFile)) {
      fail(`Chybí povinný soubor dist/${requiredFile}.`);
    }
  }
};

const verifyAssets = async () => {
  const assetsDir = path.join(distDir, "assets");
  let assetStats;
  try {
    assetStats = await fs.stat(assetsDir);
  } catch {
    fail("Chybí adresář dist/assets.");
    return;
  }

  if (!assetStats.isDirectory()) {
    fail("dist/assets existuje, ale není adresář.");
    return;
  }

  const assets = await fs.readdir(assetsDir);
  const hasJs = assets.some((asset) => asset.endsWith(".js"));
  const hasCss = assets.some((asset) => asset.endsWith(".css"));

  if (!hasJs) fail("dist/assets neobsahuje žádný JavaScript bundle.");
  if (!hasCss) fail("dist/assets neobsahuje žádný CSS bundle.");
};

const verifySpaFallback = async () => {
  const indexHtml = await fs.readFile(path.join(distDir, "index.html"), "utf8");

  if (!indexHtml.includes('<div id="root"')) {
    fail("dist/index.html neobsahuje React root element.");
  }

  if (!indexHtml.includes("/assets/")) {
    fail("dist/index.html neodkazuje na assety v dist/assets.");
  }
};

const verifyNoObviousSecrets = async () => {
  const files = await collectFiles(distDir);

  for (const file of files) {
    if (!textExtensions.has(path.extname(file))) continue;

    const content = await fs.readFile(file, "utf8");
    const relativePath = path.relative(rootDir, file);

    for (const rule of forbiddenSecretPatterns) {
      const matches = content.match(rule.pattern) ?? [];
      const unsafeMatches = rule.isAllowed
        ? matches.filter((match) => !rule.isAllowed(match))
        : matches;

      if (unsafeMatches.length > 0) {
        fail(`Možný secret ve výstupu (${rule.name}) v ${relativePath}.`);
      }
    }
  }
};

const run = async () => {
  try {
    const stats = await fs.stat(distDir);
    if (!stats.isDirectory()) {
      fail("dist existuje, ale není adresář.");
      return;
    }
  } catch {
    fail("Adresář dist neexistuje. Nejdřív spusť npm run build.");
    return;
  }

  await verifyRequiredFiles();
  await verifyAssets();
  await verifySpaFallback();
  await verifyNoObviousSecrets();

  if (process.exitCode) return;

  console.log("[verify-web-dist] dist je připravený k uploadu jako statický artifact.");
};

run().catch((error) => {
  console.error("[verify-web-dist] Ověření selhalo:", error);
  process.exit(1);
});
