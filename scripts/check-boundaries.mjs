import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import ts from "typescript";

const root = process.cwd();
const scanRoots = ["app", "features", "shared", "components", "hooks", "context", "services", "utils", "infra"];
const modernRoots = ["app", "features", "shared", "infra"];
const legacyRoots = ["components", "hooks", "services", "context", "utils"];
const allowedExt = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const forbiddenRoots = ["server", "desktop/main", "server_py"];
const allowlistPath = path.join(root, "config", "architecture-boundary-allowlist.json");
const legacyImportBaselinePath = path.join(root, "config", "legacy-import-baseline.json");

const findings = [];
const legacyImportFindings = [];
const collectionErrors = [];

const toPosix = (value) => value.replace(/\\/g, "/");

const collectFiles = (dir) => {
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) return [];
  if (fs.lstatSync(absDir).isSymbolicLink()) {
    collectionErrors.push(`Symbolický odkaz není povolen jako scan root: ${dir}`);
    return [];
  }

  const out = [];
  const stack = [absDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        collectionErrors.push(
          `Symbolický odkaz není ve skenovaných vrstvách povolen: ${toPosix(path.relative(root, next))}`,
        );
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (entry.isFile()) {
        out.push(next);
      }
    }
  }

  return out;
};

const isImportMetaGlobCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isMetaProperty(node.expression.expression) &&
  node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
  node.expression.expression.name.text === "meta" &&
  (node.expression.name.text === "glob" || node.expression.name.text === "globEager");

const extractDependencies = (content, fileName) => {
  const extension = path.extname(fileName);
  const scriptKind = extension === ".tsx"
    ? ts.ScriptKind.TSX
    : extension === ".jsx"
      ? ts.ScriptKind.JSX
      : extension === ".js" || extension === ".mjs" || extension === ".cjs"
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKind);
  const specs = [];
  const globCalls = [];
  const globErrors = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      specs.push(node.argument.literal.text);
    } else if (
      ts.isJSDocImportTag(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    } else if (isImportMetaGlobCall(node)) {
      const argument = node.arguments[0];
      let patterns = null;
      if (argument && ts.isStringLiteralLike(argument)) {
        patterns = [argument.text];
      } else if (
        argument &&
        ts.isArrayLiteralExpression(argument) &&
        argument.elements.every((element) => ts.isStringLiteralLike(element))
      ) {
        patterns = argument.elements.map((element) => element.text);
      } else {
        globErrors.push("import.meta.glob musí používat statický literál nebo pole statických literálů.");
      }

      let base = null;
      let optionsValid = true;
      const options = node.arguments[1];
      if (options) {
        if (!ts.isObjectLiteralExpression(options)) {
          globErrors.push("import.meta.glob options musí být statický objektový literál.");
          optionsValid = false;
        } else {
          for (const property of options.properties) {
            if (ts.isSpreadAssignment(property) || !property.name) {
              globErrors.push("import.meta.glob options nesmí dynamicky měnit base ani způsob párování.");
              optionsValid = false;
              continue;
            }

            const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : null;
            if (!name) {
              globErrors.push("import.meta.glob options musí mít statické názvy vlastností.");
              optionsValid = false;
              continue;
            }

            if (name === "base") {
              if (ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) {
                base = property.initializer.text;
                if (
                  !base.startsWith("/") &&
                  !base.startsWith("./") &&
                  !base.startsWith("../")
                ) {
                  globErrors.push("import.meta.glob base musí začínat /, ./ nebo ../.");
                  optionsValid = false;
                }
              } else {
                globErrors.push("import.meta.glob base musí být statický řetězec.");
                optionsValid = false;
              }
            }

            if (
              name === "exhaustive" &&
              (!ts.isPropertyAssignment(property) || property.initializer.kind !== ts.SyntaxKind.FalseKeyword)
            ) {
              globErrors.push("import.meta.glob exhaustive je podporováno pouze s hodnotou false.");
              optionsValid = false;
            }

            if (
              name === "caseSensitive" &&
              (!ts.isPropertyAssignment(property) || property.initializer.kind !== ts.SyntaxKind.TrueKeyword)
            ) {
              globErrors.push("import.meta.glob caseSensitive je podporováno pouze s hodnotou true.");
              optionsValid = false;
            }
          }
        }
      }

      if (patterns && optionsValid) {
        globCalls.push({ patterns, base });
      }
    }
    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  };
  visit(sourceFile);
  return { specs, globCalls, globErrors };
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

const resolveRepoPathFromRoot = (repoPath) => {
  const resolved = path.resolve(root, ...toPosix(repoPath).split("/"));
  const relative = toPosix(path.relative(root, resolved));
  if (relative === ".." || relative.startsWith("../")) return null;
  return relative;
};

const resolveToRepoPath = (spec, fileAbs) => {
  const modulePath = spec.split(/[?#]/, 1)[0];
  if (modulePath.startsWith("@/")) return resolveRepoPathFromRoot(modulePath.slice(2));
  if (modulePath.startsWith("@app/")) return resolveRepoPathFromRoot(`app/${modulePath.slice(5)}`);
  if (modulePath.startsWith("@features/")) return resolveRepoPathFromRoot(`features/${modulePath.slice(10)}`);
  if (modulePath.startsWith("@shared/")) return resolveRepoPathFromRoot(`shared/${modulePath.slice(8)}`);
  if (modulePath.startsWith("@infra/")) return resolveRepoPathFromRoot(`infra/${modulePath.slice(7)}`);

  if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
    const resolved = path.resolve(path.dirname(fileAbs), modulePath);
    const rel = toPosix(path.relative(root, resolved));
    if (!rel.startsWith("..")) return rel;
  }

  return null;
};

const isForbiddenRepoTarget = (repoPath) =>
  forbiddenRoots.some((rootPath) => repoPath === rootPath || repoPath.startsWith(`${rootPath}/`));

const isWithinRoot = (repoPath, rootPath) =>
  repoPath === rootPath || repoPath.startsWith(`${rootPath}/`);

const isModernPath = (repoPath) => modernRoots.some((rootPath) => isWithinRoot(repoPath, rootPath));
const isLegacyPath = (repoPath) => legacyRoots.some((rootPath) => isWithinRoot(repoPath, rootPath));

const normalizeRepoGlob = (repoPattern) => {
  const normalized = path.posix.normalize(toPosix(repoPattern));
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return null;
  }
  return normalized.startsWith("./") ? normalized.slice(2) : normalized;
};

const resolveGlobBase = (base, fileAbs) => {
  if (!base) return toPosix(path.relative(root, path.dirname(fileAbs)));
  if (!base.startsWith("/") && !base.startsWith("./") && !base.startsWith("../")) {
    return null;
  }

  const resolved = base.startsWith("/")
    ? path.resolve(root, `.${base}`)
    : path.resolve(path.dirname(fileAbs), base);
  const relative = toPosix(path.relative(root, resolved));
  if (relative === ".." || relative.startsWith("../")) return null;
  return relative;
};

const containsExtglob = (globPattern) => {
  const pattern = globPattern.startsWith("!") ? globPattern.slice(1) : globPattern;
  return /(?:^|[^\\])[?*+@!]\(/.test(pattern);
};

const containsUnsupportedGlobSyntax = (globPattern) => /[\[\]{}]/.test(globPattern);

const matchesSupportedGlob = (repoPath, globPattern) => {
  if (globPattern.endsWith("/**") && repoPath === globPattern.slice(0, -3)) {
    return true;
  }

  let source = "^";
  let segmentStart = true;
  for (let index = 0; index < globPattern.length; index += 1) {
    const character = globPattern[index];
    if (character === "*") {
      const isWholeSegmentGlobstar =
        globPattern[index + 1] === "*" &&
        (index === 0 || globPattern[index - 1] === "/") &&
        (index + 2 === globPattern.length || globPattern[index + 2] === "/");
      if (isWholeSegmentGlobstar) {
        index += 1;
        if (globPattern[index + 1] === "/") {
          index += 1;
          source += "(?:(?!\\.)[^/]+/)*";
          segmentStart = true;
        } else {
          source += "(?:(?!\\.)[^/]+(?:/(?!\\.)[^/]+)*)?";
          segmentStart = false;
        }
      } else {
        source += `${segmentStart ? "(?!\\.)" : ""}[^/]*`;
        segmentStart = false;
      }
    } else if (character === "?") {
      source += `${segmentStart ? "(?!\\.)" : ""}[^/]`;
      segmentStart = false;
    } else {
      source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
      segmentStart = character === "/";
    }
  }
  return new RegExp(`${source}$`, "u").test(repoPath);
};

const normalizeGlobPattern = (globPattern, fileAbs, base) => {
  const negative = globPattern.startsWith("!");
  const pattern = negative ? globPattern.slice(1) : globPattern;
  let repoPattern = null;

  if (pattern.startsWith("@/")) repoPattern = pattern.slice(2);
  else if (pattern.startsWith("@app/")) repoPattern = `app/${pattern.slice(5)}`;
  else if (pattern.startsWith("@features/")) repoPattern = `features/${pattern.slice(10)}`;
  else if (pattern.startsWith("@shared/")) repoPattern = `shared/${pattern.slice(8)}`;
  else if (pattern.startsWith("@infra/")) repoPattern = `infra/${pattern.slice(7)}`;
  else if (pattern.startsWith("/")) repoPattern = pattern.slice(1);
  else if (pattern.startsWith("**")) repoPattern = pattern;
  else if (pattern.startsWith("./") || pattern.startsWith("../")) {
    const basePath = resolveGlobBase(base, fileAbs);
    if (basePath === null) return null;
    repoPattern = path.posix.join(basePath, pattern);
  }

  const normalized = repoPattern ? normalizeRepoGlob(repoPattern) : null;
  return normalized ? { negative, pattern: normalized, specifier: globPattern } : null;
};

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

const allRegularFiles = scanRoots.flatMap((dir) => collectFiles(dir));
const allFiles = allRegularFiles.filter((fileAbs) => allowedExt.has(path.extname(fileAbs)));
const legacyFiles = allRegularFiles
  .map((fileAbs) => toPosix(path.relative(root, fileAbs)))
  .filter((fileRel) => isLegacyPath(fileRel) && !fileRel.split("/").includes("node_modules"));

for (const fileAbs of allFiles) {
  const fileRel = toPosix(path.relative(root, fileAbs));
  const content = fs.readFileSync(fileAbs, "utf8");
  const { specs, globCalls, globErrors } = extractDependencies(content, fileAbs);

  if (isModernPath(fileRel)) {
    for (const error of globErrors) {
      collectionErrors.push(`${fileRel}: ${error}`);
    }

    const normalizedGlobCalls = globCalls.map(({ patterns, base }) =>
      patterns.map((globPattern) => {
        const unsignedPattern = globPattern.startsWith("!") ? globPattern.slice(1) : globPattern;
        const hasBackslash = globPattern.includes("\\");
        const hasExtglob = containsExtglob(globPattern);
        const hasUnsupportedSyntax = containsUnsupportedGlobSyntax(globPattern);
        const hasRepeatedLeadingSlash = unsignedPattern.startsWith("//");
        const hasTrailingSlash = unsignedPattern.endsWith("/");
        const trailingGlobstarPrefix = unsignedPattern.endsWith("/**")
          ? unsignedPattern.slice(0, -3)
          : null;
        const hasWildcardTrailingGlobstar =
          trailingGlobstarPrefix !== null && /[*?]/.test(trailingGlobstarPrefix);
        return {
          original: globPattern,
          error: hasBackslash
            ? "backslash není povolen; Vite glob musí používat POSIX oddělovače"
            : hasExtglob
              ? "extglob syntax není povolena, protože Vite ji vyhodnocuje odlišně"
              : hasUnsupportedSyntax
                ? "pokročilá syntax [] a {} není podporována fail-closed matcherem"
                : hasRepeatedLeadingSlash
                  ? "opakované úvodní lomítko není podporováno"
                  : hasTrailingSlash
                    ? "koncové lomítko není podporováno"
                    : hasWildcardTrailingGlobstar
                      ? "wildcard prefix před koncovým globstarem není podporován"
                      : null,
          normalized: hasBackslash || hasExtglob || hasUnsupportedSyntax ||
              hasRepeatedLeadingSlash || hasTrailingSlash || hasWildcardTrailingGlobstar
            ? null
            : normalizeGlobPattern(globPattern, fileAbs, base),
        };
      }),
    );
    for (const normalizedGlobs of normalizedGlobCalls) {
      for (const item of normalizedGlobs) {
        if (item.error) {
          collectionErrors.push(`${fileRel}: import.meta.glob ${item.error}: ${item.original}`);
        } else if (!item.normalized) {
          collectionErrors.push(
            `${fileRel}: import.meta.glob vzor nelze bezpečně vyhodnotit: ${item.original}`,
          );
        }
      }

      const validGlobs = normalizedGlobs
        .map((item) => item.normalized)
        .filter(Boolean);
      const positiveGlobs = validGlobs.filter((item) => !item.negative);
      const negativeGlobs = validGlobs.filter((item) => item.negative);

      for (const glob of positiveGlobs) {
        for (const target of legacyFiles) {
          let matches = matchesSupportedGlob(target, glob.pattern);
          if (
            matches &&
            negativeGlobs.some((excluded) => matchesSupportedGlob(target, excluded.pattern))
          ) {
            matches = false;
          }

          if (matches) {
            legacyImportFindings.push({
              type: "modern-to-legacy-import",
              file: fileRel,
              specifier: glob.specifier,
              target,
              detail: `Moderní vrstva globem importuje legacy modul: ${target} (z ${glob.specifier})`,
            });
          }
        }
      }
    }
  }

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

    if (target && isModernPath(fileRel) && isLegacyPath(target)) {
      legacyImportFindings.push({
        type: "modern-to-legacy-import",
        file: fileRel,
        specifier: spec,
        target,
        detail: `Moderní vrstva importuje legacy modul: ${target} (z ${spec})`,
      });
    }

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
const addedLegacyBaselineImports = previousLegacyImportBaseline.available
  ? allowedLegacyImports.filter((allowed) => !previousLegacyImportKeys.has(legacyImportKey(allowed)))
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
  `Boundary check OK (${allFiles.length} souborů, boundary výjimek: ${allowedFindings.length}, legacy importů: ${uniqueLegacyImportFindings.length}).`,
);
