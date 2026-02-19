import fs from "fs";
import path from "path";

const root = process.cwd();
const scanRoots = ["app", "features", "shared", "components", "hooks", "context", "services", "utils", "infra"];
const allowedExt = new Set([".ts", ".tsx", ".js", ".mjs"]);
const forbiddenRoots = ["server", "desktop/main", "server_py", "mcp-bridge-server"];
const allowlistPath = path.join(root, "config", "architecture-boundary-allowlist.json");

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
  fileRel.startsWith("app/") ||
  fileRel.startsWith("features/") ||
  fileRel.startsWith("shared/") ||
  fileRel.startsWith("components/") ||
  fileRel.startsWith("hooks/") ||
  fileRel.startsWith("context/") ||
  fileRel.startsWith("services/") ||
  fileRel.startsWith("utils/") ||
  fileRel.startsWith("infra/");

const isUiLayer = (fileRel) =>
  fileRel.startsWith("app/") ||
  fileRel.startsWith("features/") ||
  fileRel.startsWith("shared/") ||
  fileRel.startsWith("components/") ||
  fileRel.startsWith("hooks/") ||
  fileRel.startsWith("context/");

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

const loadAllowlist = () => {
  if (!fs.existsSync(allowlistPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    if (!Array.isArray(parsed?.allowedFindings)) return [];
    return parsed.allowedFindings
      .map((item) => ({
        type: typeof item?.type === "string" ? item.type : "",
        file: typeof item?.file === "string" ? item.file : "",
      }))
      .filter((item) => item.type && item.file);
  } catch {
    return [];
  }
};

const allowedFindings = loadAllowlist();
const isAllowedFinding = (finding) =>
  allowedFindings.some((allowed) => allowed.type === finding.type && allowed.file === finding.file);

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

    if (fileRel.startsWith("features/")) {
      if (spec.startsWith("@/components/") || spec.startsWith("@components/") || (target && target.startsWith("components/"))) {
        findings.push({
          type: "features-to-components",
          file: fileRel,
          detail: `features vrstva nesmí importovat legacy components: ${spec}`,
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

    if (isUiLayer(fileRel)) {
      const isSupabaseImport =
        spec === "@/services/supabase" ||
        spec === "../services/supabase" ||
        spec === "../../services/supabase" ||
        spec === "../../../services/supabase" ||
        (target && target === "services/supabase");
      if (isSupabaseImport) {
        findings.push({
          type: "ui-direct-supabase-import",
          file: fileRel,
          detail: `UI vrstva nesmí importovat Supabase přímo: ${spec}`,
        });
      }
    }

    if (target && isForbiddenRepoTarget(target)) {
      findings.push({
        type: "forbidden-web-import",
        file: fileRel,
        detail: `Web vrstva importuje zakázanou cestu: ${target} (z ${spec})`,
      });
    }
  }

  if (
    isUiLayer(fileRel) &&
    !fileRel.startsWith("services/platformAdapter.ts") &&
    content.includes("window.electronAPI")
  ) {
    findings.push({
      type: "renderer-bypass-platform-adapter",
      file: fileRel,
      detail: "Renderer nesmí přistupovat na window.electronAPI mimo services/platformAdapter.ts",
    });
  }
}

const unresolvedFindings = findings.filter((finding) => !isAllowedFinding(finding));

if (unresolvedFindings.length > 0) {
  console.error("Boundary check selhal. Nalezené problémy:\n");
  for (const finding of unresolvedFindings) {
    console.error(`- [${finding.type}] ${finding.file}: ${finding.detail}`);
  }
  process.exit(1);
}

console.log(
  `Boundary check OK (${allFiles.length} souborů, allowlist položek: ${allowedFindings.length}, nalezeno: ${findings.length}).`,
);
