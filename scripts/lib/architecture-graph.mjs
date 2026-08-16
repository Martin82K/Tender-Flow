import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const ARCHITECTURE_SCAN_ROOTS = Object.freeze([
  "app",
  "features",
  "shared",
  "components",
  "hooks",
  "context",
  "services",
  "utils",
  "infra",
]);

export const ARCHITECTURE_SOURCE_EXTENSIONS = Object.freeze([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const sourceExtensions = new Set(ARCHITECTURE_SOURCE_EXTENSIONS);

export const toPosix = (value) => value.replace(/\\/g, "/");

const isImportMetaGlobCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isMetaProperty(node.expression.expression) &&
  node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
  node.expression.expression.name.text === "meta" &&
  (node.expression.name.text === "glob" || node.expression.name.text === "globEager");

export const extractModuleDependencies = (content, fileName) => {
  const extension = path.extname(fileName);
  const scriptKind = extension === ".tsx"
    ? ts.ScriptKind.TSX
    : extension === ".jsx"
      ? ts.ScriptKind.JSX
      : extension === ".js" || extension === ".mjs" || extension === ".cjs"
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
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
              (!ts.isPropertyAssignment(property) ||
                property.initializer.kind !== ts.SyntaxKind.FalseKeyword)
            ) {
              globErrors.push("import.meta.glob exhaustive je podporováno pouze s hodnotou false.");
              optionsValid = false;
            }

            if (
              name === "caseSensitive" &&
              (!ts.isPropertyAssignment(property) ||
                property.initializer.kind !== ts.SyntaxKind.TrueKeyword)
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

const resolveRepoPathFromRoot = (repoPath, root) => {
  const resolved = path.resolve(root, ...toPosix(repoPath).split("/"));
  const relative = toPosix(path.relative(root, resolved));
  if (relative === ".." || relative.startsWith("../")) return null;
  return relative;
};

export const resolveModuleSpecifier = (spec, fileAbs, root) => {
  const modulePath = spec.split(/[?#]/, 1)[0];
  if (modulePath.startsWith("@/")) {
    return resolveRepoPathFromRoot(modulePath.slice(2), root);
  }
  if (modulePath.startsWith("@app/")) {
    return resolveRepoPathFromRoot(`app/${modulePath.slice(5)}`, root);
  }
  if (modulePath.startsWith("@components/")) {
    return resolveRepoPathFromRoot(`components/${modulePath.slice(12)}`, root);
  }
  if (modulePath.startsWith("@features/")) {
    return resolveRepoPathFromRoot(`features/${modulePath.slice(10)}`, root);
  }
  if (modulePath.startsWith("@shared/")) {
    return resolveRepoPathFromRoot(`shared/${modulePath.slice(8)}`, root);
  }
  if (modulePath.startsWith("@infra/")) {
    return resolveRepoPathFromRoot(`infra/${modulePath.slice(7)}`, root);
  }

  if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
    const resolved = path.resolve(path.dirname(fileAbs), modulePath);
    const relative = toPosix(path.relative(root, resolved));
    if (!relative.startsWith("..")) return relative;
  }

  return null;
};

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

const resolveGlobBase = (base, fileAbs, root) => {
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

const normalizeGlobPattern = (globPattern, fileAbs, base, root) => {
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
    const basePath = resolveGlobBase(base, fileAbs, root);
    if (basePath === null) return null;
    repoPattern = path.posix.join(basePath, pattern);
  }

  const normalized = repoPattern ? normalizeRepoGlob(repoPattern) : null;
  return normalized ? { negative, pattern: normalized, specifier: globPattern } : null;
};

const normalizeGlobCalls = (globCalls, fileAbs, root) =>
  globCalls.map(({ patterns, base }) =>
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
      const error = hasBackslash
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
                  : null;

      return {
        original: globPattern,
        error,
        normalized: error ? null : normalizeGlobPattern(globPattern, fileAbs, base, root),
      };
    }),
  );

const collectRegularFiles = (root, scanRoots) => {
  const regularFiles = [];
  const collectionErrors = [];

  for (const scanRoot of scanRoots) {
    const absDir = path.join(root, scanRoot);
    if (!fs.existsSync(absDir)) continue;
    if (fs.lstatSync(absDir).isSymbolicLink()) {
      collectionErrors.push(`Symbolický odkaz není povolen jako scan root: ${scanRoot}`);
      continue;
    }

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
          regularFiles.push(next);
        }
      }
    }
  }

  return { regularFiles, collectionErrors };
};

export const collectArchitectureGraph = ({
  root = process.cwd(),
  scanRoots = ARCHITECTURE_SCAN_ROOTS,
} = {}) => {
  const { regularFiles: regularFilePaths, collectionErrors } = collectRegularFiles(root, scanRoots);
  const regularFiles = regularFilePaths.map((fileAbs) => toPosix(path.relative(root, fileAbs)));
  const globTargets = regularFiles.filter((file) => !file.split("/").includes("node_modules"));
  const nodes = [];
  const edges = [];

  for (const fileAbs of regularFilePaths) {
    if (!sourceExtensions.has(path.extname(fileAbs))) continue;

    const file = toPosix(path.relative(root, fileAbs));
    const content = fs.readFileSync(fileAbs, "utf8");
    const { specs, globCalls, globErrors } = extractModuleDependencies(content, fileAbs);
    const normalizedGlobCalls = normalizeGlobCalls(globCalls, fileAbs, root);
    const globDiagnostics = [];

    for (const normalizedGlobs of normalizedGlobCalls) {
      for (const item of normalizedGlobs) {
        if (item.error) {
          globDiagnostics.push(`import.meta.glob ${item.error}: ${item.original}`);
        } else if (!item.normalized) {
          globDiagnostics.push(`import.meta.glob vzor nelze bezpečně vyhodnotit: ${item.original}`);
        }
      }

      const validGlobs = normalizedGlobs
        .map((item) => item.normalized)
        .filter(Boolean);
      const positiveGlobs = validGlobs.filter((item) => !item.negative);
      const negativeGlobs = validGlobs.filter((item) => item.negative);

      for (const glob of positiveGlobs) {
        for (const target of globTargets) {
          let matches = matchesSupportedGlob(target, glob.pattern);
          if (
            matches &&
            negativeGlobs.some((excluded) => matchesSupportedGlob(target, excluded.pattern))
          ) {
            matches = false;
          }

          if (matches) {
            edges.push({
              file,
              specifier: glob.specifier,
              target,
              kind: "glob",
            });
          }
        }
      }
    }

    for (const specifier of specs) {
      const target = resolveModuleSpecifier(specifier, fileAbs, root);
      if (target) {
        edges.push({ file, specifier, target, kind: "static" });
      }
    }

    nodes.push({
      file,
      fileAbs,
      content,
      specs,
      globCalls,
      globErrors,
      globDiagnostics,
    });
  }

  const uniqueEdges = [
    ...new Map(
      edges.map((edge) => [
        `${edge.file}\0${edge.specifier}\0${edge.target}`,
        edge,
      ]),
    ).values(),
  ];

  return { nodes, edges: uniqueEdges, regularFiles, collectionErrors };
};
