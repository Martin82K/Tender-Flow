import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const ARCHITECTURE_SCAN_ROOTS = Object.freeze([
  "index.tsx",
  "App.tsx",
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

const defaultGraphLimits = Object.freeze({
  maxRegularFiles: 10_000,
  maxSourceFileBytes: 2 * 1024 * 1024,
  maxTotalSourceBytes: 64 * 1024 * 1024,
  maxGlobPatterns: 1_000,
  maxRawEdges: 250_000,
  maxDependencyBytes: 4_096,
  maxTotalEdgeBytes: 32 * 1024 * 1024,
  maxGlobMatchWork: 50_000_000,
});

const normalizeGraphLimits = (limits = {}) => Object.fromEntries(
  Object.entries(defaultGraphLimits).map(([name, maximum]) => {
    const requested = limits[name];
    return [
      name,
      Number.isSafeInteger(requested) && requested > 0
        ? Math.min(requested, maximum)
        : maximum,
    ];
  }),
);

export const toPosix = (value) => value.replace(/\\/g, "/");

const isImportMetaGlobCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isMetaProperty(node.expression.expression) &&
  node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
  node.expression.expression.name.text === "meta" &&
  (node.expression.name.text === "glob" || node.expression.name.text === "globEager");

const commonJsBindingIdentifier = (node) => {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    return node.expression;
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    (
      (node.expression.expression.text === "require" && node.expression.name.text === "resolve") ||
      (node.expression.expression.text === "module" && node.expression.name.text === "require")
    )
  ) {
    return node.expression.expression;
  }
  return null;
};

const createLocalBindingLookup = (sourceFile, fileName) => {
  let checker = null;
  const isRuntimeDeclaration = (declaration) => {
    if (declaration.getSourceFile().isDeclarationFile) return false;
    for (let current = declaration; current && !ts.isSourceFile(current); current = current.parent) {
      if (ts.canHaveModifiers(current)) {
        const modifiers = ts.getModifiers(current) ?? [];
        if (modifiers.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword)) return false;
      }
    }
    return true;
  };

  return (identifier) => {
    if (checker === null) {
      const compilerHost = {
        directoryExists: () => true,
        fileExists: (candidate) => candidate === fileName,
        getCanonicalFileName: (candidate) => candidate,
        getCurrentDirectory: () => "",
        getDefaultLibFileName: () => "",
        getDirectories: () => [],
        getNewLine: () => "\n",
        getSourceFile: (candidate) => candidate === fileName ? sourceFile : undefined,
        readFile: (candidate) => candidate === fileName ? sourceFile.text : undefined,
        useCaseSensitiveFileNames: () => true,
        writeFile: () => {},
      };
      const program = ts.createProgram({
        rootNames: [fileName],
        options: { allowJs: true, checkJs: true, noLib: true, noResolve: true, types: [] },
        host: compilerHost,
      });
      checker = program.getTypeChecker();
    }
    const symbol = checker.getSymbolAtLocation(identifier);
    return symbol?.declarations?.some(isRuntimeDeclaration) ?? false;
  };
};

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
  const hasLocalBinding = createLocalBindingLookup(sourceFile, fileName);

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      if (node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
        specs.push(node.moduleReference.expression.text);
      } else {
        globErrors.push("import = require musí používat jeden statický literál.");
      }
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
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        specs.push(node.arguments[0].text);
      } else {
        globErrors.push("import() musí používat jeden statický literál.");
      }
    } else if (commonJsBindingIdentifier(node)) {
      const bindingIdentifier = commonJsBindingIdentifier(node);
      if (hasLocalBinding(bindingIdentifier)) {
        for (const child of node.getChildren(sourceFile)) visit(child);
        return;
      }
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        specs.push(node.arguments[0].text);
      } else {
        globErrors.push("require musí používat jeden statický literál.");
      }
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

const matchesGlobSegment = (value, pattern) => {
  if (value.startsWith(".") && (pattern.startsWith("*") || pattern.startsWith("?"))) {
    return false;
  }

  const valueCharacters = [...value];
  let previous = new Uint8Array(valueCharacters.length + 1);
  previous[0] = 1;
  for (const token of pattern) {
    const current = new Uint8Array(valueCharacters.length + 1);
    if (token === "*") current[0] = previous[0];
    for (let index = 1; index <= valueCharacters.length; index += 1) {
      if (token === "*") {
        current[index] = previous[index] || current[index - 1] ? 1 : 0;
      } else if (token === "?" || token === valueCharacters[index - 1]) {
        current[index] = previous[index - 1];
      }
    }
    previous = current;
  }
  return previous[valueCharacters.length] === 1;
};

export const matchesSupportedGlob = (repoPath, globPattern) => {
  const pathSegments = repoPath.split("/");
  const patternSegments = globPattern.split("/");
  let previous = new Uint8Array(pathSegments.length + 1);
  previous[0] = 1;

  for (const patternSegment of patternSegments) {
    const current = new Uint8Array(pathSegments.length + 1);
    if (patternSegment === "**") {
      current[0] = previous[0];
      for (let index = 1; index <= pathSegments.length; index += 1) {
        current[index] = previous[index] ||
          (current[index - 1] && !pathSegments[index - 1].startsWith("."))
          ? 1
          : 0;
      }
    } else {
      for (let index = 1; index <= pathSegments.length; index += 1) {
        if (previous[index - 1] && matchesGlobSegment(pathSegments[index - 1], patternSegment)) {
          current[index] = 1;
        }
      }
    }
    previous = current;
  }

  return previous[pathSegments.length] === 1;
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

const collectRegularFiles = (root, scanRoots, limits) => {
  const regularFiles = [];
  const collectionErrors = [];

  for (const scanRoot of scanRoots) {
    const absDir = path.join(root, scanRoot);
    if (!fs.existsSync(absDir)) continue;
    const scanRootStat = fs.lstatSync(absDir);
    if (scanRootStat.isSymbolicLink()) {
      collectionErrors.push(`Symbolický odkaz není povolen jako scan root: ${scanRoot}`);
      continue;
    }

    if (scanRootStat.isFile()) {
      if (regularFiles.length >= limits.maxRegularFiles) {
        collectionErrors.push(
          `Graf překračuje limit ${limits.maxRegularFiles} regulárních souborů.`,
        );
        return { regularFiles, collectionErrors };
      }
      regularFiles.push(absDir);
      continue;
    }

    if (!scanRootStat.isDirectory()) continue;

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
          if (regularFiles.length >= limits.maxRegularFiles) {
            collectionErrors.push(
              `Graf překračuje limit ${limits.maxRegularFiles} regulárních souborů.`,
            );
            return { regularFiles, collectionErrors };
          }
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
  limits,
} = {}) => {
  const graphLimits = normalizeGraphLimits(limits);
  const { regularFiles: regularFilePaths, collectionErrors } = collectRegularFiles(
    root,
    scanRoots,
    graphLimits,
  );
  const regularFiles = regularFilePaths.map((fileAbs) => toPosix(path.relative(root, fileAbs)));
  const globTargets = regularFiles.filter((file) => !file.split("/").includes("node_modules"));
  const nodes = [];
  const edges = [];
  let totalSourceBytes = 0;
  let globPatternCount = 0;
  let rawEdgeLimitReached = false;
  let totalEdgeBytes = 0;
  let globMatchWork = 0;
  let globMatchLimitReached = false;

  const addEdge = (edge) => {
    if (rawEdgeLimitReached) return false;
    if (edges.length >= graphLimits.maxRawEdges) {
      collectionErrors.push(`Graf překračuje limit ${graphLimits.maxRawEdges} surových hran.`);
      rawEdgeLimitReached = true;
      return false;
    }
    const edgeBytes = Buffer.byteLength(edge.file, "utf8") +
      Buffer.byteLength(edge.specifier, "utf8") +
      Buffer.byteLength(edge.target, "utf8") +
      Buffer.byteLength(edge.kind, "utf8");
    if (totalEdgeBytes + edgeBytes > graphLimits.maxTotalEdgeBytes) {
      collectionErrors.push(
        `Graf překračuje celkový limit ${graphLimits.maxTotalEdgeBytes} bajtů hran.`,
      );
      rawEdgeLimitReached = true;
      return false;
    }
    totalEdgeBytes += edgeBytes;
    edges.push(edge);
    return true;
  };

  const matchesGlobWithinBudget = (target, pattern) => {
    if (globMatchLimitReached) return false;
    globMatchWork += target.length * pattern.length;
    if (globMatchWork > graphLimits.maxGlobMatchWork) {
      collectionErrors.push(
        `Graf překračuje limit ${graphLimits.maxGlobMatchWork} jednotek glob párování.`,
      );
      globMatchLimitReached = true;
      return false;
    }
    return matchesSupportedGlob(target, pattern);
  };

  for (const fileAbs of regularFilePaths) {
    if (!sourceExtensions.has(path.extname(fileAbs))) continue;

    const file = toPosix(path.relative(root, fileAbs));
    const sourceBytes = fs.statSync(fileAbs).size;
    if (sourceBytes > graphLimits.maxSourceFileBytes) {
      collectionErrors.push(
        `${file}: zdrojový soubor překračuje limit ${graphLimits.maxSourceFileBytes} bajtů.`,
      );
      continue;
    }
    totalSourceBytes += sourceBytes;
    if (totalSourceBytes > graphLimits.maxTotalSourceBytes) {
      collectionErrors.push(
        `Graf překračuje celkový limit ${graphLimits.maxTotalSourceBytes} bajtů zdrojového kódu.`,
      );
      break;
    }
    const content = fs.readFileSync(fileAbs, "utf8");
    const { specs, globCalls, globErrors } = extractModuleDependencies(content, fileAbs);
    const globDiagnostics = [];

    globPatternCount += globCalls.reduce((count, call) => count + call.patterns.length, 0);
    const globPatternLimitExceeded = globPatternCount > graphLimits.maxGlobPatterns;
    if (globPatternLimitExceeded) {
      const message = `Graf překračuje limit ${graphLimits.maxGlobPatterns} glob vzorů.`;
      if (!collectionErrors.includes(message)) collectionErrors.push(message);
    }
    let oversizedGlobPattern = null;
    for (const call of globCalls) {
      oversizedGlobPattern = call.patterns.find(
        (pattern) => Buffer.byteLength(pattern, "utf8") > graphLimits.maxDependencyBytes,
      ) ?? null;
      if (oversizedGlobPattern) break;
    }
    if (oversizedGlobPattern) {
      collectionErrors.push(
        `${file}: glob vzor překračuje limit ${graphLimits.maxDependencyBytes} bajtů: ` +
        JSON.stringify(oversizedGlobPattern),
      );
    }
    const normalizedGlobCalls = globPatternLimitExceeded || oversizedGlobPattern
      ? []
      : normalizeGlobCalls(globCalls, fileAbs, root);

    for (const normalizedGlobs of normalizedGlobCalls) {
      if (rawEdgeLimitReached) break;
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
      const excludedTargets = new Set();

      for (const target of globTargets) {
        if (globMatchLimitReached) break;
        if (negativeGlobs.some((excluded) =>
          globMatchLimitReached || matchesGlobWithinBudget(target, excluded.pattern))) {
          excludedTargets.add(target);
        }
      }

      for (const glob of positiveGlobs) {
        if (rawEdgeLimitReached || globMatchLimitReached) break;
        for (const target of globTargets) {
          if (globMatchLimitReached) break;
          let matches = matchesGlobWithinBudget(target, glob.pattern);
          if (matches && excludedTargets.has(target)) matches = false;

          if (matches) {
            if (!addEdge({
              file,
              specifier: glob.specifier,
              target,
              kind: "glob",
            })) break;
          }
        }
      }
    }

    for (const specifier of specs) {
      if (rawEdgeLimitReached) break;
      if (Buffer.byteLength(specifier, "utf8") > graphLimits.maxDependencyBytes) {
        collectionErrors.push(
          `${file}: import specifier překračuje limit ${graphLimits.maxDependencyBytes} bajtů: ` +
          JSON.stringify(specifier),
        );
        continue;
      }
      const target = resolveModuleSpecifier(specifier, fileAbs, root);
      if (target) {
        addEdge({ file, specifier, target, kind: "static" });
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

  const uniqueEdges = [];
  const seenEdges = new Map();
  for (const edge of edges) {
    const specifiers = seenEdges.get(edge.file) ?? new Map();
    const targets = specifiers.get(edge.specifier) ?? new Set();
    if (!targets.has(edge.target)) {
      targets.add(edge.target);
      uniqueEdges.push(edge);
    }
    specifiers.set(edge.specifier, targets);
    seenEdges.set(edge.file, specifiers);
  }

  return { nodes, edges: uniqueEdges, regularFiles, collectionErrors };
};
