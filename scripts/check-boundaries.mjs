import fs from "fs";
import path from "path";

const root = process.cwd();
const scanRoots = ["app", "features", "shared"];
const allowedExt = new Set([".ts", ".tsx", ".js", ".mjs"]);
const forbiddenRoots = ["server", "desktop/main", "server_py", "mcp-bridge-server"];

const findings = [];

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
      if (allowedExt.has(path.extname(entry.name))) {
        out.push(next);
      }
    }
  }

  return out;
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

const isWebLayer = (fileRel) =>
  fileRel.startsWith("app/") || fileRel.startsWith("features/") || fileRel.startsWith("shared/");

const resolveToRepoPath = (spec, fileAbs) => {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith("@app/")) return `app/${spec.slice(5)}`;
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

const isForbiddenRepoTarget = (repoPath) =>
  forbiddenRoots.some((rootPath) => repoPath === rootPath || repoPath.startsWith(`${rootPath}/`));

const allFiles = scanRoots.flatMap((dir) => collectFiles(dir));

for (const fileAbs of allFiles) {
  const fileRel = toPosix(path.relative(root, fileAbs));
  const content = fs.readFileSync(fileAbs, "utf8");
  const specs = extractSpecifiers(content);

  for (const spec of specs) {
    if (!isWebLayer(fileRel)) continue;

    if (/^(?:\.\.\/){3,}/.test(spec)) {
      findings.push({
        type: "deep-relative-import",
        file: fileRel,
        detail: `Nepovolený deep relativní import: ${spec}`,
      });
    }

    const target = resolveToRepoPath(spec, fileAbs);

    if (fileRel.startsWith("shared/")) {
      if (spec.startsWith("@features/") || spec.startsWith("@/features/") || (target && target.startsWith("features/"))) {
        findings.push({
          type: "shared-to-features",
          file: fileRel,
          detail: `shared vrstva nesmí importovat features: ${spec}`,
        });
      }
    }

    if (
      spec.startsWith("server/") ||
      spec.startsWith("desktop/main/") ||
      spec.startsWith("server_py/") ||
      spec.startsWith("mcp-bridge-server/") ||
      spec.startsWith("@/server") ||
      spec.startsWith("@/desktop/main") ||
      spec.startsWith("@/server_py") ||
      spec.startsWith("@/mcp-bridge-server") ||
      spec.startsWith("@app/server") ||
      spec.startsWith("@features/server") ||
      spec.startsWith("@shared/server")
    ) {
      findings.push({
        type: "forbidden-web-import",
        file: fileRel,
        detail: `Web vrstva importuje zakázaný modul: ${spec}`,
      });
    }

    if (target && isForbiddenRepoTarget(target)) {
      findings.push({
        type: "forbidden-web-import",
        file: fileRel,
        detail: `Web vrstva importuje zakázanou cestu: ${target} (z ${spec})`,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Boundary check selhal. Nalezené problémy:\n");
  for (const finding of findings) {
    console.error(`- [${finding.type}] ${finding.file}: ${finding.detail}`);
  }
  process.exit(1);
}

console.log(`Boundary check OK (${allFiles.length} souborů).`);
