import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import {
  ARCHITECTURE_SCAN_ROOTS,
  collectArchitectureGraph,
  resolveModuleSpecifier,
} from "./lib/architecture-graph.mjs";

const root = process.cwd();
const scanRoots = ARCHITECTURE_SCAN_ROOTS;
const modernRoots = ["app", "features", "shared", "infra"];
const modernEntryFiles = new Set(["index.tsx", "App.tsx"]);
const legacyRoots = ["components", "hooks", "services", "context", "utils"];
const forbiddenRoots = ["server", "desktop/main", "server_py"];
const allowlistPath = path.join(root, "config", "architecture-boundary-allowlist.json");
const legacyImportBaselinePath = path.join(root, "config", "legacy-import-baseline.json");

const findings = [];
const legacyImportFindings = [];
const collectionErrors = [];

const isWebLayer = (fileRel) =>
  modernEntryFiles.has(fileRel) ||
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
  modernEntryFiles.has(fileRel) ||
  fileRel.startsWith("app/") ||
  fileRel.startsWith("features/") ||
  fileRel.startsWith("shared/") ||
  fileRel.startsWith("components/") ||
  fileRel.startsWith("hooks/") ||
  fileRel.startsWith("context/");

const isForbiddenRepoTarget = (repoPath) =>
  forbiddenRoots.some((rootPath) => repoPath === rootPath || repoPath.startsWith(`${rootPath}/`));

const isWithinRoot = (repoPath, rootPath) =>
  repoPath === rootPath || repoPath.startsWith(`${rootPath}/`);

const isModernPath = (repoPath) =>
  modernEntryFiles.has(repoPath) || modernRoots.some((rootPath) => isWithinRoot(repoPath, rootPath));
const isLegacyPath = (repoPath) => legacyRoots.some((rootPath) => isWithinRoot(repoPath, rootPath));

const loadAllowlist = () => {
  if (!fs.existsSync(allowlistPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    if (!Array.isArray(parsed?.allowedFindings)) return [];
    return parsed.allowedFindings
      .map((item) => ({
        type: typeof item?.type === "string" ? item.type : "",
        file: typeof item?.file === "string" ? item.file : "",
        specifier: typeof item?.specifier === "string" ? item.specifier : null,
      }))
      .filter(
        (item) =>
          item.type &&
          item.file &&
          (item.type !== "feature-private-import" || item.specifier !== null),
      );
  } catch {
    return [];
  }
};

const allowedFindings = loadAllowlist();
const allowedFindingMatches = (allowed, finding) =>
  allowed.type === finding.type &&
  allowed.file === finding.file &&
  (allowed.specifier === null || allowed.specifier === finding.specifier);

const isAllowedFinding = (finding) =>
  allowedFindings.some((allowed) => allowedFindingMatches(allowed, finding));

const legacyImportKey = (item) => `${item.file}\0${item.specifier}\0${item.target}`;
const compareLegacyImports = (left, right) => legacyImportKey(left).localeCompare(legacyImportKey(right));
const modernEntryScopeBootstrapKeys = new Set([
  legacyImportKey({
    file: "index.tsx",
    specifier: "./services/incidentLogger",
    target: "services/incidentLogger",
  }),
]);

const loadLegacyImportBaseline = () => {
  if (!fs.existsSync(legacyImportBaselinePath)) return { allowedImports: [], errors: [] };

  try {
    const parsed = JSON.parse(fs.readFileSync(legacyImportBaselinePath, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed?.allowedImports)) {
      return {
        allowedImports: [],
        errors: ["config/legacy-import-baseline.json musí mít version 1 a pole allowedImports."],
      };
    }

    const allowedImports = parsed.allowedImports.map((item) => ({
      file: typeof item?.file === "string" ? item.file : "",
      specifier: typeof item?.specifier === "string" ? item.specifier : "",
      target: typeof item?.target === "string" ? item.target : "",
    }));
    const errors = [];

    for (const item of allowedImports) {
      if (!item.file || !item.specifier || !item.target) {
        errors.push("Legacy import baseline obsahuje neúplnou položku.");
        continue;
      }
      if (!isModernPath(item.file) || !isLegacyPath(item.target)) {
        errors.push(`Legacy import baseline obsahuje neplatnou hranu: ${item.file} -> ${item.target}`);
      }
    }

    const keys = allowedImports.map(legacyImportKey);
    if (new Set(keys).size !== keys.length) {
      errors.push("Legacy import baseline obsahuje duplicitní položky.");
    }
    const sortedKeys = [...allowedImports].sort(compareLegacyImports).map(legacyImportKey);
    if (keys.some((key, index) => key !== sortedKeys[index])) {
      errors.push("Legacy import baseline musí být deterministicky seřazený.");
    }

    return { allowedImports, errors };
  } catch {
    return {
      allowedImports: [],
      errors: ["config/legacy-import-baseline.json není platný JSON."],
    };
  }
};

const {
  allowedImports: allowedLegacyImports,
  errors: legacyImportBaselineErrors,
} = loadLegacyImportBaseline();

const loadPreviousLegacyImportBaseline = () => {
  const configuredRef = process.env.LEGACY_IMPORT_BASELINE_REF;
  const baselineRef = configuredRef || "HEAD";

  try {
    execFileSync("git", ["cat-file", "-e", `${baselineRef}^{commit}`], {
      cwd: root,
      stdio: "pipe",
    });
  } catch {
    return configuredRef
      ? { available: false, allowedImports: [], errors: [`Nelze načíst Git baseline ref ${baselineRef}.`] }
      : { available: false, allowedImports: [], errors: [] };
  }

  let content = "";
  try {
    execFileSync(
      "git",
      ["cat-file", "-e", `${baselineRef}:config/legacy-import-baseline.json`],
      { cwd: root, stdio: "pipe" },
    );
  } catch {
    return { available: false, allowedImports: [], errors: [] };
  }

  try {
    content = execFileSync(
      "git",
      ["show", `${baselineRef}:config/legacy-import-baseline.json`],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    return {
      available: false,
      allowedImports: [],
      errors: [`Git baseline ${baselineRef} obsahuje baseline soubor, ale nelze jej načíst.`],
    };
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed?.version !== 1 || !Array.isArray(parsed?.allowedImports)) {
      return {
        available: false,
        allowedImports: [],
        errors: [`Git baseline ${baselineRef} nemá platné schema.`],
      };
    }
    const allowedImports = parsed.allowedImports.map((item) => ({
      file: typeof item?.file === "string" ? item.file : "",
      specifier: typeof item?.specifier === "string" ? item.specifier : "",
      target: typeof item?.target === "string" ? item.target : "",
    }));
    return { available: true, allowedImports, errors: [] };
  } catch {
    return {
      available: false,
      allowedImports: [],
      errors: [`Git baseline ${baselineRef} není platný JSON.`],
    };
  }
};

const previousLegacyImportBaseline = loadPreviousLegacyImportBaseline();

const getFeatureName = (repoPath) => {
  const match = /^features\/([^/]+)(?:\/|$)/.exec(repoPath);
  return match?.[1] ?? null;
};

const isPublicFeatureEntrypoint = (repoPath, featureName) => {
  const suffix = repoPath.slice(`features/${featureName}`.length);
  return suffix === "" || /^\/index(?:\.[cm]?[jt]sx?)?$/.test(suffix);
};

const architectureGraph = collectArchitectureGraph({ root, scanRoots });
collectionErrors.push(...architectureGraph.collectionErrors);

for (const node of architectureGraph.nodes) {
  if (!isModernPath(node.file)) continue;
  for (const error of node.globErrors) {
    collectionErrors.push(`${node.file}: ${error}`);
  }
  for (const diagnostic of node.globDiagnostics) {
    collectionErrors.push(`${node.file}: ${diagnostic}`);
  }
}

for (const edge of architectureGraph.edges) {
  if (!isModernPath(edge.file) || !isLegacyPath(edge.target)) continue;
  legacyImportFindings.push({
    type: "modern-to-legacy-import",
    file: edge.file,
    specifier: edge.specifier,
    target: edge.target,
    detail: edge.kind === "glob"
      ? `Moderní vrstva globem importuje legacy modul: ${edge.target} (z ${edge.specifier})`
      : `Moderní vrstva importuje legacy modul: ${edge.target} (z ${edge.specifier})`,
  });
}

for (const node of architectureGraph.nodes) {
  const { file: fileRel, fileAbs, content, specs } = node;

  for (const spec of specs) {
    if (!isWebLayer(fileRel)) continue;

    if (/^(?:\.\.\/){3,}/.test(spec)) {
      findings.push({
        type: "deep-relative-import",
        file: fileRel,
        detail: `Nepovolený deep relativní import: ${spec}`,
      });
    }

    const target = resolveModuleSpecifier(spec, fileAbs, root);

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

      const sourceFeature = getFeatureName(fileRel);
      const targetFeature = target ? getFeatureName(target) : null;
      if (
        sourceFeature &&
        targetFeature &&
        sourceFeature !== targetFeature &&
        !isPublicFeatureEntrypoint(target, targetFeature)
      ) {
        findings.push({
          type: "feature-private-import",
          file: fileRel,
          specifier: spec,
          detail: `feature ${sourceFeature} smí importovat ${targetFeature} pouze přes veřejný entrypoint: ${spec}`,
        });
      }
    }

    if (
      spec.startsWith("server/") ||
      spec.startsWith("desktop/main/") ||
      spec.startsWith("server_py/") ||
      spec.startsWith("@/server") ||
      spec.startsWith("@/desktop/main") ||
      spec.startsWith("@/server_py") ||
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
const unusedAllowedFindings = allowedFindings.filter(
  (allowed) => !findings.some((finding) => allowedFindingMatches(allowed, finding)),
);
const uniqueLegacyImportFindings = [
  ...new Map(legacyImportFindings.map((finding) => [legacyImportKey(finding), finding])).values(),
].sort(compareLegacyImports);
const allowedLegacyImportKeys = new Set(allowedLegacyImports.map(legacyImportKey));
const actualLegacyImportKeys = new Set(uniqueLegacyImportFindings.map(legacyImportKey));
const unresolvedLegacyImports = uniqueLegacyImportFindings.filter(
  (finding) => !allowedLegacyImportKeys.has(legacyImportKey(finding)),
);
const unusedLegacyImports = allowedLegacyImports.filter(
  (allowed) => !actualLegacyImportKeys.has(legacyImportKey(allowed)),
);
const previousLegacyImportKeys = new Set(
  previousLegacyImportBaseline.allowedImports.map(legacyImportKey),
);
const bootstrapsModernEntryScope =
  previousLegacyImportBaseline.available &&
  !previousLegacyImportBaseline.allowedImports.some(({ file }) => modernEntryFiles.has(file));
const addedLegacyBaselineImports = previousLegacyImportBaseline.available
  ? allowedLegacyImports.filter((allowed) =>
      !previousLegacyImportKeys.has(legacyImportKey(allowed)) &&
      !(
        bootstrapsModernEntryScope &&
        modernEntryScopeBootstrapKeys.has(legacyImportKey(allowed))
      ))
  : [];

if (
  unresolvedFindings.length > 0 ||
  unusedAllowedFindings.length > 0 ||
  unresolvedLegacyImports.length > 0 ||
  unusedLegacyImports.length > 0 ||
  legacyImportBaselineErrors.length > 0 ||
  previousLegacyImportBaseline.errors.length > 0 ||
  addedLegacyBaselineImports.length > 0 ||
  collectionErrors.length > 0
) {
  if (collectionErrors.length > 0) {
    console.error("Boundary scan nelze bezpečně dokončit:\n");
    for (const error of collectionErrors) {
      console.error(`- ${error}`);
    }
  }
  if (unresolvedFindings.length > 0) {
    console.error("Boundary check selhal. Nalezené problémy:\n");
    for (const finding of unresolvedFindings) {
      console.error(`- [${finding.type}] ${finding.file}: ${finding.detail}`);
    }
  }

  if (unusedAllowedFindings.length > 0) {
    console.error("Boundary allowlist obsahuje zastaralé výjimky:\n");
    for (const allowed of unusedAllowedFindings) {
      const specifier = allowed.specifier ? ` (${allowed.specifier})` : "";
      console.error(`- [${allowed.type}] ${allowed.file}${specifier}`);
    }
  }

  if (legacyImportBaselineErrors.length > 0) {
    console.error("Legacy import baseline je neplatný:\n");
    for (const error of legacyImportBaselineErrors) {
      console.error(`- ${error}`);
    }
  }

  if (previousLegacyImportBaseline.errors.length > 0) {
    console.error("Předchozí legacy import baseline nelze ověřit:\n");
    for (const error of previousLegacyImportBaseline.errors) {
      console.error(`- ${error}`);
    }
  }

  if (addedLegacyBaselineImports.length > 0) {
    console.error("Legacy import baseline se nesmí rozšiřovat oproti výchozí revizi:\n");
    for (const item of addedLegacyBaselineImports) {
      console.error(`- ${item.file}: ${item.target} (${item.specifier})`);
    }
  }

  if (unresolvedLegacyImports.length > 0) {
    console.error("Nové modern-to-legacy importy nejsou v baseline:\n");
    for (const finding of unresolvedLegacyImports) {
      console.error(`- [${finding.type}] ${finding.file}: ${finding.detail}`);
    }
  }

  if (unusedLegacyImports.length > 0) {
    console.error("Zastaralé legacy import výjimky:\n");
    for (const allowed of unusedLegacyImports) {
      console.error(`- ${allowed.file}: ${allowed.target} (${allowed.specifier})`);
    }
  }
  process.exit(1);
}

console.log(
  `Boundary check OK (${architectureGraph.nodes.length} souborů, boundary výjimek: ${allowedFindings.length}, legacy importů: ${uniqueLegacyImportFindings.length}).`,
);
