import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const scanRoots = ["app", "features", "shared", "components", "hooks", "context", "services", "utils", "infra"];
const codeExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const largeFileLineThreshold = 800;

const trackedRootKeepFiles = new Set([
  ".gitignore",
  "AGENTS.md",
  "App.tsx",
  "CLAUDE.md",
  "README.md",
  "app.yaml",
  "declarations.d.ts",
  "electron-builder.yml",
  "env.d.ts",
  "favicon.png",
  "index.css",
  "index.html",
  "index.tsx",
  "package-lock.json",
  "package.json",
  "postcss.config.js",
  "tailwind.config.js",
  "tsconfig.json",
  "types.ts",
  "vercel.json",
  "vite.config.ts",
  "vitest.config.ts",
  "window.d.ts",
]);

const trackedRootMoveCandidates = new Map([
  ["TAILWIND_V4_MIGRATION.md", "historicka migracni poznamka patri do docs/"],
  ["backup_before_split.patch", "historicky manualni patch patri do archive/ nebo k odstraneni po overeni"],
  ["latest-win-downloaded.yml", "pravdepodobny release/update artefakt nema byt v koreni"],
]);

const trackedRootReviewCandidates = new Map([
  ["dev-app-update.yml", "overit, zda ho Electron updater vyzaduje v koreni"],
  ["metadata.json", "overit toolchain/hosting zavislost pred presunem"],
  ["server.js", "presunout az po overeni start/hosting konfiguraci"],
]);

const ignoredLocalRootPatterns = [
  ".DS_Store",
  ".env",
  ".env.*",
  ".env.local",
  ".env_backup",
  ".tmp/",
  "dist/",
  "dist-electron/",
];

const toPosix = (value) => value.replace(/\\/g, "/");

const collectFiles = (dir) => {
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) return [];

  const out = [];
  const stack = [absDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (codeExt.has(path.extname(entry.name))) {
        out.push(next);
      }
    }
  }

  return out.sort();
};

const extractSpecifiers = (content) => {
  const patterns = [
    /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  const specs = [];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
};

const resolveToRepoPath = (spec, fileAbs) => {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith("@app/")) return `app/${spec.slice(5)}`;
  if (spec.startsWith("@components/")) return `components/${spec.slice(12)}`;
  if (spec.startsWith("@features/")) return `features/${spec.slice(10)}`;
  if (spec.startsWith("@shared/")) return `shared/${spec.slice(8)}`;
  if (spec.startsWith("@infra/")) return `infra/${spec.slice(7)}`;

  if (spec.startsWith("./") || spec.startsWith("../")) {
    const resolved = path.resolve(path.dirname(fileAbs), spec);
    const rel = toPosix(path.relative(root, resolved));
    if (!rel.startsWith("..")) return rel;
  }

  return null;
};

const readTrackedFiles = () => {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const lineCount = (content) => {
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length;
};

const dedupeFindings = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.file}\0${item.specifier}\0${item.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dependencyFindings = {
  "shared-to-components": [],
  "features-to-legacy-hooks": [],
  "features-to-legacy-context": [],
  "features-to-legacy-services": [],
  "features-to-legacy-utils": [],
};

const sharedUi = {
  temporaryShims: [],
  primitives: [],
};

const largeFiles = [];
const allFiles = scanRoots.flatMap((dir) => collectFiles(dir));

for (const fileAbs of allFiles) {
  const file = toPosix(path.relative(root, fileAbs));
  const content = fs.readFileSync(fileAbs, "utf8");
  const specs = extractSpecifiers(content);
  const resolvedImports = specs
    .map((specifier) => ({
      specifier,
      target: resolveToRepoPath(specifier, fileAbs),
    }))
    .filter((item) => item.target);

  if (file.startsWith("shared/")) {
    for (const item of resolvedImports) {
      if (item.target.startsWith("components/")) {
        dependencyFindings["shared-to-components"].push({ file, specifier: item.specifier, target: item.target });
      }
    }
  }

  if (file.startsWith("features/")) {
    for (const item of resolvedImports) {
      if (item.target.startsWith("hooks/")) {
        dependencyFindings["features-to-legacy-hooks"].push({ file, specifier: item.specifier, target: item.target });
      }
      if (item.target.startsWith("context/")) {
        dependencyFindings["features-to-legacy-context"].push({ file, specifier: item.specifier, target: item.target });
      }
      if (item.target.startsWith("services/")) {
        dependencyFindings["features-to-legacy-services"].push({ file, specifier: item.specifier, target: item.target });
      }
      if (item.target.startsWith("utils/")) {
        dependencyFindings["features-to-legacy-utils"].push({ file, specifier: item.specifier, target: item.target });
      }
    }
  }

  if (file.startsWith("shared/ui/") || file === "shared/ui/index.ts") {
    const componentTargets = resolvedImports
      .filter((item) => item.target.startsWith("components/"))
      .map((item) => item.target);

    if (componentTargets.length > 0) {
      sharedUi.temporaryShims.push({
        file,
        kind: "legacy-component-reexport",
        targets: [...new Set(componentTargets)].sort(),
      });
    } else {
      sharedUi.primitives.push({ file });
    }
  }

  const lines = lineCount(content);
  if (lines > largeFileLineThreshold) {
    largeFiles.push({ file, lines });
  }
}

for (const key of Object.keys(dependencyFindings)) {
  dependencyFindings[key] = dedupeFindings(dependencyFindings[key]).sort(
    (a, b) => a.file.localeCompare(b.file) || a.target.localeCompare(b.target),
  );
}
sharedUi.temporaryShims.sort((a, b) => a.file.localeCompare(b.file));
sharedUi.primitives.sort((a, b) => a.file.localeCompare(b.file));
largeFiles.sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const trackedRootFiles = readTrackedFiles()
  .filter((file) => !file.includes("/"))
  .sort();

const rootFiles = {
  keep: [],
  moveCandidates: [],
  reviewCandidates: [],
  sensitiveTracked: [],
  ignoredLocalPatterns: ignoredLocalRootPatterns,
};

for (const file of trackedRootFiles) {
  if (/^\.env(?:\.|$)|^\.env_backup$/.test(file)) {
    rootFiles.sensitiveTracked.push(file);
    continue;
  }
  if (trackedRootKeepFiles.has(file)) {
    rootFiles.keep.push(file);
    continue;
  }
  if (trackedRootMoveCandidates.has(file)) {
    rootFiles.moveCandidates.push({ file, reason: trackedRootMoveCandidates.get(file) });
    continue;
  }
  if (trackedRootReviewCandidates.has(file)) {
    rootFiles.reviewCandidates.push({ file, reason: trackedRootReviewCandidates.get(file) });
    continue;
  }
  rootFiles.reviewCandidates.push({ file, reason: "neznamy root soubor, vyzaduje manualni klasifikaci" });
}

const totalDependencyFindings = Object.values(dependencyFindings).reduce((sum, items) => sum + items.length, 0);

const report = {
  thresholds: {
    largeFileLineThreshold,
  },
  totals: {
    scannedCodeFiles: allFiles.length,
    dependencyFindings: totalDependencyFindings,
    sharedUiTemporaryShims: sharedUi.temporaryShims.length,
    sharedUiPrimitives: sharedUi.primitives.length,
    largeFiles: largeFiles.length,
    rootMoveCandidates: rootFiles.moveCandidates.length,
    rootReviewCandidates: rootFiles.reviewCandidates.length,
    sensitiveTrackedRootFiles: rootFiles.sensitiveTracked.length,
  },
  dependencyFindings,
  sharedUi,
  largeFiles,
  rootFiles,
};

const printMarkdown = () => {
  const lines = [
    "# Audit architektonickeho dluhu",
    "",
    `- Skenovano code souboru: ${report.totals.scannedCodeFiles}`,
    `- Prechodove import vazby: ${report.totals.dependencyFindings}`,
    `- Shared UI shimy: ${report.totals.sharedUiTemporaryShims}`,
    `- Shared UI primitives: ${report.totals.sharedUiPrimitives}`,
    `- Soubory nad ${largeFileLineThreshold} radku: ${report.totals.largeFiles}`,
    `- Root kandidati k presunu: ${report.totals.rootMoveCandidates}`,
    `- Root kandidati k overeni: ${report.totals.rootReviewCandidates}`,
    `- Tracked citlive root soubory: ${report.totals.sensitiveTrackedRootFiles}`,
    "",
    "## Import vazby",
  ];

  for (const [key, items] of Object.entries(dependencyFindings)) {
    lines.push("", `### ${key}`, "");
    if (items.length === 0) {
      lines.push("- zadne");
      continue;
    }
    for (const item of items) {
      lines.push(`- ${item.file} -> ${item.target} (${item.specifier})`);
    }
  }

  lines.push("", "## Shared UI klasifikace", "", "### temporary shims", "");
  if (sharedUi.temporaryShims.length === 0) {
    lines.push("- zadne");
  } else {
    for (const item of sharedUi.temporaryShims) {
      lines.push(`- ${item.file} -> ${item.targets.join(", ")}`);
    }
  }

  lines.push("", "### primitives", "");
  if (sharedUi.primitives.length === 0) {
    lines.push("- zadne");
  } else {
    for (const item of sharedUi.primitives) {
      lines.push(`- ${item.file}`);
    }
  }

  lines.push("", "## Velke soubory", "");
  if (largeFiles.length === 0) {
    lines.push("- zadne");
  } else {
    for (const item of largeFiles) {
      lines.push(`- ${item.file}: ${item.lines} radku`);
    }
  }

  lines.push("", "## Root hygiene", "", "### move candidates", "");
  if (rootFiles.moveCandidates.length === 0) {
    lines.push("- zadne");
  } else {
    for (const item of rootFiles.moveCandidates) {
      lines.push(`- ${item.file}: ${item.reason}`);
    }
  }

  lines.push("", "### review candidates", "");
  if (rootFiles.reviewCandidates.length === 0) {
    lines.push("- zadne");
  } else {
    for (const item of rootFiles.reviewCandidates) {
      lines.push(`- ${item.file}: ${item.reason}`);
    }
  }

  lines.push("", "### sensitive tracked root files", "");
  if (rootFiles.sensitiveTracked.length === 0) {
    lines.push("- zadne");
  } else {
    for (const file of rootFiles.sensitiveTracked) {
      lines.push(`- ${file}`);
    }
  }

  console.log(lines.join("\n"));
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printMarkdown();
}
