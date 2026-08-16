import path from "node:path";
import { createHash } from "node:crypto";

import {
  collectArchitectureGraph,
} from "./architecture-graph.mjs";
import {
  analyzeDirectedGraph,
  resolveArchitectureModuleGraph,
} from "./architecture-graph-analysis.mjs";
import { readRegularTextFileLimited } from "./safe-file-read.mjs";

export const ARCHITECTURE_GRAPH_REPORT_SCHEMA_VERSION = 1;

export const ARCHITECTURE_GRAPH_REPORT_ROOTS = Object.freeze([
  "index.tsx",
  "App.tsx",
  "env.d.ts",
  "window.d.ts",
  "declarations.d.ts",
  "types.ts",
  "types",
  "config",
  "fonts",
  "app",
  "features",
  "shared",
  "infra",
  "components",
  "hooks",
  "services",
  "context",
  "utils",
]);

export const ARCHITECTURE_GRAPH_MODERN_ROOTS = Object.freeze([
  "app",
  "features",
  "shared",
  "infra",
  "types",
  "config",
  "fonts",
]);

export const ARCHITECTURE_GRAPH_LEGACY_ROOTS = Object.freeze([
  "components",
  "hooks",
  "services",
  "context",
  "utils",
]);

const MAX_POLICY_ITEMS = 250_000;
const MAX_ENTRY_FILE_BYTES = 1024 * 1024;
const REQUIRED_PLAN_LOOPS = 16;
const MAX_TEXT_BYTES = 4_096;
const DEBT_METRIC_KEYS = Object.freeze([
  "legacyNodes",
  "modernToLegacyImports",
  "legacyInternalImports",
  "cyclicComponents",
]);
const INITIAL_DEBT_EVIDENCE = Object.freeze({
  fingerprint: "sha256:497d50e607a31d63b105bbb6caacdd669f26b3c5b5fe5704ec32f29763ada338",
  metrics: Object.freeze({
    legacyNodes: 113,
    modernToLegacyImports: 135,
    legacyInternalImports: 137,
    cyclicComponents: 1,
  }),
});
const TRUSTED_V1_PLAN_DIGEST = "cfa1b32c58c7bcb692f010b9782c2f4131e836ac09ab124fcfb1bb48852d6901";
const TRUSTED_V2_PLAN_DIGEST = "47fffd71cdbb68b4b636da30f271fdad7695ec83a0c96956390e00b0a8804de5";

const compareCodePoint = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const assertPlainObject = (value, label) => {
  if (!isPlainObject(value)) throw new TypeError(`${label} musí být objekt.`);
};

const assertText = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} musí být neprázdný řetězec.`);
  }
  if (Buffer.byteLength(value, "utf8") > MAX_TEXT_BYTES) {
    throw new RangeError(`${label} překračuje limit ${MAX_TEXT_BYTES} bajtů.`);
  }
  if (/\p{Cc}|\p{Cf}/u.test(value)) {
    throw new TypeError(`${label} obsahuje řídicí znaky.`);
  }
  return value;
};

const assertRepoPath = (value, label) => {
  assertText(value, label);
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    path.posix.normalize(value) !== value ||
    value.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError(`${label} musí být kanonická relativní POSIX cesta.`);
  }
  return value;
};

const assertSortedUnique = (values, label, comparator = compareCodePoint) => {
  for (let index = 1; index < values.length; index += 1) {
    const comparison = comparator(values[index - 1], values[index]);
    if (comparison === 0) throw new TypeError(`${label} obsahuje duplicitu.`);
    if (comparison > 0) throw new TypeError(`${label} musí být deterministicky seřazené.`);
  }
};

const isWithinRoot = (moduleId, root) =>
  moduleId === root || moduleId.startsWith(`${root}/`);

const isWithinRoots = (moduleId, roots) =>
  roots.some((root) => isWithinRoot(moduleId, root));
const isDeclarationFile = (moduleId) => /(?:^|\/)[^/]+\.d\.(?:ts|mts|cts)$/.test(moduleId);

const layerOf = (moduleId) => {
  if (isWithinRoots(moduleId, ARCHITECTURE_GRAPH_LEGACY_ROOTS)) return "legacy";
  if (
    isWithinRoots(moduleId, ARCHITECTURE_GRAPH_MODERN_ROOTS) ||
    moduleId === "index.tsx" ||
    moduleId === "App.tsx" ||
    moduleId === "types.ts" ||
    moduleId === "env.d.ts" ||
    moduleId === "window.d.ts" ||
    moduleId === "declarations.d.ts" ||
    isDeclarationFile(moduleId)
  ) return "modern";
  return "other";
};

const assertRegularEntryFile = (root, relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return readRegularTextFileLimited(
    absolutePath,
    `Kanonický produkční entrypoint ${relativePath}`,
    MAX_ENTRY_FILE_BYTES,
  );
};

const collectScriptAttributeSources = (html) => {
  const scripts = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = lowerHtml.indexOf("<script", cursor);
    if (start === -1) break;
    const boundary = html[start + 7];
    if (boundary && !/[\s/>]/.test(boundary)) {
      cursor = start + 7;
      continue;
    }
    let quote = null;
    let end = start + 7;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (end >= html.length) throw new TypeError("index.html obsahuje neukončený script tag.");
    scripts.push(html.slice(start + 7, end));
    cursor = end + 1;
  }
  return scripts;
};

const parseHtmlAttributes = (source) => {
  const attributes = new Map();
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s|\//.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;
    const nameStart = cursor;
    while (cursor < source.length && !/[\s=/>]/.test(source[cursor])) cursor += 1;
    const name = source.slice(nameStart, cursor).toLowerCase();
    if (!name) throw new TypeError("index.html obsahuje neplatný atribut script tagu.");
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    let value = "";
    if (source[cursor] === "=") {
      cursor += 1;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      const quote = source[cursor] === '"' || source[cursor] === "'" ? source[cursor++] : null;
      const valueStart = cursor;
      if (quote) {
        while (cursor < source.length && source[cursor] !== quote) cursor += 1;
        if (cursor >= source.length) throw new TypeError("index.html obsahuje neukončený atribut.");
        value = source.slice(valueStart, cursor);
        cursor += 1;
      } else {
        while (cursor < source.length && !/[\s>]/.test(source[cursor])) cursor += 1;
        value = source.slice(valueStart, cursor);
      }
    }
    if (attributes.has(name)) throw new TypeError(`index.html obsahuje duplicitní atribut ${name}.`);
    attributes.set(name, value);
  }
  return attributes;
};

const stripHtmlComments = (html) => {
  const chunks = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<!--", cursor);
    if (start === -1) {
      chunks.push(html.slice(cursor));
      break;
    }
    chunks.push(html.slice(cursor, start));
    const end = html.indexOf("-->", start + 4);
    if (end === -1) throw new TypeError("index.html obsahuje neukončený HTML komentář.");
    cursor = end + 3;
  }
  return chunks.join("");
};

const collectProductionEntrypointDiagnostics = (root, rawGraph) => {
  try {
    const htmlContent = assertRegularEntryFile(root, "index.html");
    assertRegularEntryFile(root, "index.tsx");
    assertRegularEntryFile(root, "App.tsx");

    const sourceNodes = new Set(rawGraph.nodes.map(({ file }) => file));
    for (const entrypoint of ["index.tsx", "App.tsx"]) {
      if (!sourceNodes.has(entrypoint)) {
        throw new TypeError(`Kanonický produkční entrypoint ${entrypoint} není součástí grafu.`);
      }
    }

    const html = stripHtmlComments(htmlContent);
    const moduleSources = [];
    for (const source of collectScriptAttributeSources(html)) {
      const attributes = parseHtmlAttributes(source);
      const type = (attributes.get("type") ?? "").toLowerCase();
      if (type === "application/ld+json") continue;
      if (type !== "module" || type.includes("&")) {
        throw new TypeError("index.html obsahuje nepovolený spustitelný script.");
      }
      const moduleSource = attributes.get("src");
      if (!moduleSource || moduleSource.includes("&")) {
        throw new TypeError("Produkční module script v index.html musí mít statický src.");
      }
      moduleSources.push(moduleSource);
    }
    if (moduleSources.length !== 1 || moduleSources[0] !== "/index.tsx") {
      throw new TypeError(
        "index.html musí obsahovat právě jeden kanonický module entrypoint /index.tsx.",
      );
    }
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : "Nelze ověřit produkční entrypointy."];
  }
};

const importKey = ({ file, specifier, target }) => `${file}\u0000${specifier}\u0000${target}`;

const compareImports = (left, right) =>
  compareCodePoint(left.file, right.file) ||
  compareCodePoint(left.specifier, right.specifier) ||
  compareCodePoint(left.target, right.target);

const cycleKey = (nodes) => nodes.join("\u0000");

const compareCycles = (left, right) => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = compareCodePoint(left[index], right[index]);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
};

const validateDebtEvidence = (value, label) => {
  assertPlainObject(value, label);
  if (typeof value.fingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.fingerprint)) {
    throw new TypeError(`${label}.fingerprint musí být SHA-256 fingerprint.`);
  }
  assertPlainObject(value.metrics, `${label}.metrics`);
  const metrics = {};
  for (const key of DEBT_METRIC_KEYS) {
    const metric = value.metrics[key];
    if (!Number.isSafeInteger(metric) || metric < 0) {
      throw new TypeError(`${label}.metrics.${key} musí být nezáporné celé číslo.`);
    }
    metrics[key] = metric;
  }
  return { fingerprint: value.fingerprint, metrics };
};

const metricsEqual = (left, right) =>
  DEBT_METRIC_KEYS.every((key) => left[key] === right[key]);

const metricsDoNotIncrease = (current, ceiling) =>
  DEBT_METRIC_KEYS.every((key) => current[key] <= ceiling[key]);

const metricsStrictlyDecrease = (current, previous) =>
  DEBT_METRIC_KEYS.some((key) => current[key] < previous[key]);

export const validateArchitectureGraphPolicy = (policy) => {
  assertPlainObject(policy, "Architecture graph policy");
  if (policy.version !== 1) throw new TypeError("Architecture graph policy musí mít version 1.");

  const unresolvedImports = policy.allowedUnresolvedImports;
  const cycles = policy.allowedCycles;
  const internalImports = policy.allowedLegacyInternalImports;
  if (!Array.isArray(unresolvedImports)) {
    throw new TypeError("allowedUnresolvedImports musí být pole.");
  }
  if (!Array.isArray(cycles)) throw new TypeError("allowedCycles musí být pole.");
  if (!Array.isArray(internalImports)) {
    throw new TypeError("allowedLegacyInternalImports musí být pole.");
  }
  if (
    unresolvedImports.length > MAX_POLICY_ITEMS ||
    cycles.length > MAX_POLICY_ITEMS ||
    internalImports.length > MAX_POLICY_ITEMS
  ) {
    throw new RangeError(`Architecture graph policy překračuje limit ${MAX_POLICY_ITEMS} položek.`);
  }

  const normalizedUnresolvedImports = unresolvedImports.map((edge, index) => {
    assertPlainObject(edge, `allowedUnresolvedImports[${index}]`);
    const normalized = {
      file: assertRepoPath(edge.file, `allowedUnresolvedImports[${index}].file`),
      specifier: assertText(edge.specifier, `allowedUnresolvedImports[${index}].specifier`),
      target: assertRepoPath(edge.target, `allowedUnresolvedImports[${index}].target`),
    };
    if (normalized.file === "types.ts" || normalized.file.startsWith("types/")) {
      throw new TypeError("Importy z types kontraktu nesmí být povoleny jako unresolved.");
    }
    const assetExtension = path.posix.extname(normalized.target);
    if (!new Set([".css", ".svg", ".png", ".webp", ".jpg"]).has(assetExtension)) {
      throw new TypeError(
        `${normalized.target} není podporované nezdrojové aktivum pro allowedUnresolvedImports.`,
      );
    }
    return normalized;
  });
  assertSortedUnique(
    normalizedUnresolvedImports,
    "allowedUnresolvedImports",
    compareImports,
  );

  const normalizedCycles = cycles.map((cycle, cycleIndex) => {
    if (!Array.isArray(cycle) || cycle.length === 0) {
      throw new TypeError(`allowedCycles[${cycleIndex}] musí být neprázdné pole.`);
    }
    const nodes = cycle.map((node, nodeIndex) =>
      assertRepoPath(node, `allowedCycles[${cycleIndex}][${nodeIndex}]`));
    assertSortedUnique(nodes, `allowedCycles[${cycleIndex}]`);
    return nodes;
  });
  assertSortedUnique(normalizedCycles, "allowedCycles", compareCycles);

  const normalizedInternalImports = internalImports.map((edge, index) => {
    assertPlainObject(edge, `allowedLegacyInternalImports[${index}]`);
    const normalized = {
      file: assertRepoPath(edge.file, `allowedLegacyInternalImports[${index}].file`),
      specifier: assertText(edge.specifier, `allowedLegacyInternalImports[${index}].specifier`),
      target: assertRepoPath(edge.target, `allowedLegacyInternalImports[${index}].target`),
    };
    if (!isWithinRoots(normalized.file, ARCHITECTURE_GRAPH_LEGACY_ROOTS)) {
      throw new TypeError(`${normalized.file} není zdroj v legacy vrstvě.`);
    }
    if (!isWithinRoots(normalized.target, ARCHITECTURE_GRAPH_LEGACY_ROOTS)) {
      throw new TypeError(`${normalized.target} není cíl v legacy vrstvě.`);
    }
    return normalized;
  });
  assertSortedUnique(
    normalizedInternalImports,
    "allowedLegacyInternalImports",
    compareImports,
  );

  return {
    version: 1,
    allowedUnresolvedImports: normalizedUnresolvedImports,
    allowedCycles: normalizedCycles,
    allowedLegacyInternalImports: normalizedInternalImports,
  };
};

const validateStringList = (values, label) => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${label} musí být neprázdné pole.`);
  }
  return values.map((value, index) => assertText(value, `${label}[${index}]`));
};

export const validateArchitectureMigrationPlan = (plan) => {
  assertPlainObject(plan, "Architecture migration plan");
  if (plan.version !== 2) throw new TypeError("Architecture migration plan musí mít version 2.");
  const baselineDebt = validateDebtEvidence(plan.baselineDebt, "baselineDebt");
  if (!Array.isArray(plan.loops) || plan.loops.length !== REQUIRED_PLAN_LOOPS) {
    throw new TypeError(`Architecture migration plan musí obsahovat přesně ${REQUIRED_PLAN_LOOPS} smyček.`);
  }

  const knownIds = new Set();
  const normalizedLoops = plan.loops.map((loop, index) => {
    assertPlainObject(loop, `loops[${index}]`);
    const expectedId = `loop-${String(index + 1).padStart(2, "0")}`;
    const id = assertText(loop.id, `loops[${index}].id`);
    if (id !== expectedId) {
      throw new TypeError(`loops[${index}].id musí být ${expectedId}.`);
    }
    if (!new Set(["planned", "in_progress", "complete"]).has(loop.status)) {
      throw new TypeError(`${id}.status má neplatnou hodnotu.`);
    }
    if (!Array.isArray(loop.dependencies)) {
      throw new TypeError(`${id}.dependencies musí být pole.`);
    }
    const dependencies = loop.dependencies.map((dependency, dependencyIndex) =>
      assertText(dependency, `${id}.dependencies[${dependencyIndex}]`));
    if (new Set(dependencies).size !== dependencies.length) {
      throw new TypeError(`${id}.dependencies obsahuje duplicitu.`);
    }
    for (const dependency of dependencies) {
      if (!knownIds.has(dependency)) {
        throw new TypeError(`${id} odkazuje na neznámou nebo pozdější závislost ${dependency}.`);
      }
    }
    knownIds.add(id);

    const completionEvidence = loop.completionEvidence == null
      ? null
      : validateDebtEvidence(loop.completionEvidence, `${id}.completionEvidence`);
    if (loop.status === "complete" && completionEvidence === null) {
      throw new TypeError(`${id} je complete, ale nemá completionEvidence.`);
    }
    if (loop.status !== "complete" && completionEvidence !== null) {
      throw new TypeError(`${id} nesmí mít completionEvidence před dokončením.`);
    }

    return {
      id,
      title: assertText(loop.title, `${id}.title`),
      status: loop.status,
      objective: assertText(loop.objective, `${id}.objective`),
      dependencies,
      exitCriteria: validateStringList(loop.exitCriteria, `${id}.exitCriteria`),
      riskChecks: validateStringList(loop.riskChecks, `${id}.riskChecks`),
      testGates: validateStringList(loop.testGates, `${id}.testGates`),
      completionEvidence,
    };
  });

  const inProgress = normalizedLoops.filter(({ status }) => status === "in_progress");
  const statusRank = new Map([["complete", 0], ["in_progress", 1], ["planned", 2]]);
  for (let index = 1; index < normalizedLoops.length; index += 1) {
    if (statusRank.get(normalizedLoops[index].status) < statusRank.get(normalizedLoops[index - 1].status)) {
      throw new TypeError(
        "Stavy smyček musí postupovat complete → in_progress → planned; pouze první nedokončená smyčka smí běžet.",
      );
    }
  }
  const firstIncomplete = normalizedLoops.find(({ status }) => status !== "complete");
  if (inProgress.length > 1 || (inProgress.length === 1 && inProgress[0] !== firstIncomplete)) {
    throw new TypeError(
      "Pouze první nedokončená smyčka smí být in_progress; plán může mezi smyčkami čekat na schválení.",
    );
  }

  let previousDebt = baselineDebt;
  for (const [index, loop] of normalizedLoops.entries()) {
    if (loop.status !== "complete") break;
    if (!metricsDoNotIncrease(loop.completionEvidence.metrics, previousDebt.metrics)) {
      throw new TypeError(`${loop.id}.completionEvidence nesmí zvyšovat legacy dluh.`);
    }
    if (index > 0 && !metricsStrictlyDecrease(loop.completionEvidence.metrics, previousDebt.metrics)) {
      throw new TypeError(`${loop.id}.completionEvidence musí prokázat měřitelný pokles dluhu.`);
    }
    previousDebt = loop.completionEvidence;
  }
  const finalLoop = normalizedLoops.at(-1);
  if (
    finalLoop.status === "complete" &&
    DEBT_METRIC_KEYS.some((key) => finalLoop.completionEvidence.metrics[key] !== 0)
  ) {
    throw new TypeError("loop-16 completionEvidence musí mít nulový legacy dluh.");
  }

  return { version: 2, baselineDebt, loops: normalizedLoops };
};

const normalizePreviousArchitectureMigrationPlan = (previousPlan, currentPlan) => {
  if (previousPlan?.version === 2) return validateArchitectureMigrationPlan(previousPlan);
  assertPlainObject(previousPlan, "Předchozí architecture migration plan");
  const trustedDigest = previousPlan.__trustedSourceDigest;
  if (
    !(
      (previousPlan.version === 0 && trustedDigest === TRUSTED_V2_PLAN_DIGEST) ||
      (previousPlan.version === 1 && trustedDigest === TRUSTED_V1_PLAN_DIGEST)
    )
  ) {
    throw new TypeError("Předchozí architecture migration plan musí mít version 1 nebo 2.");
  }
  if (previousPlan.version === 1) {
    if (!Array.isArray(previousPlan.loops) || previousPlan.loops.length !== REQUIRED_PLAN_LOOPS) {
      throw new TypeError(`Předchozí plan v1 musí obsahovat ${REQUIRED_PLAN_LOOPS} smyček.`);
    }
    for (const [index, loop] of previousPlan.loops.entries()) {
      const expectedId = `loop-${String(index + 1).padStart(2, "0")}`;
      const expectedStatus = index === 0 ? "in_progress" : "planned";
      if (loop?.id !== expectedId || loop?.status !== expectedStatus || loop?.completionEvidence != null) {
        throw new TypeError(
          "Předchozí plan v1 lze migrovat jen z původního stavu loop-01 in_progress a ostatní planned.",
        );
      }
    }
  }
  if (JSON.stringify(currentPlan.baselineDebt) !== JSON.stringify(INITIAL_DEBT_EVIDENCE)) {
    throw new TypeError("Jednorázová migrace plánu musí zachovat připnutý initial baselineDebt.");
  }
  return validateArchitectureMigrationPlan({
    version: 2,
    baselineDebt: INITIAL_DEBT_EVIDENCE,
    loops: currentPlan.loops.map((loop, index) => ({
      ...loop,
      status: index === 0 ? "in_progress" : "planned",
      completionEvidence: undefined,
    })),
  });
};

export const summarizeArchitectureMigrationPlan = (plan) => {
  const validated = validateArchitectureMigrationPlan(plan);
  return {
    total: validated.loops.length,
    complete: validated.loops.filter(({ status }) => status === "complete").length,
    inProgress: validated.loops.find(({ status }) => status === "in_progress")?.id ?? null,
    planned: validated.loops.filter(({ status }) => status === "planned").length,
  };
};

const collectDiagnostics = (rawGraph) => {
  const diagnostics = [...rawGraph.collectionErrors];
  for (const node of rawGraph.nodes) {
    for (const error of node.globErrors) diagnostics.push(`${node.file}: ${error}`);
    for (const error of node.globDiagnostics) diagnostics.push(`${node.file}: ${error}`);
  }
  return [...new Set(diagnostics)].sort(compareCodePoint);
};

export const fingerprintArchitectureDebt = (payload) =>
  `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;

export const buildArchitectureDebtSnapshot = ({ resolved, analysis }) => {
  const legacyNodes = resolved.nodes
    .filter((node) => layerOf(node) === "legacy")
    .sort(compareCodePoint);
  const modernToLegacyImports = resolved.edges
    .filter(({ file, target }) => layerOf(file) === "modern" && layerOf(target) === "legacy")
    .map(({ file, specifier, target }) => ({ file, specifier, target }))
    .sort(compareImports);
  const legacyInternalImports = resolved.edges
    .filter(({ file, target }) => layerOf(file) === "legacy" && layerOf(target) === "legacy")
    .map(({ file, specifier, target }) => ({ file, specifier, target }))
    .sort(compareImports);
  const cycles = analysis.stronglyConnectedComponents
    .filter(({ cyclic }) => cyclic)
    .map(({ nodes }) => [...nodes])
    .sort(compareCycles);
  const payload = {
    legacyNodes,
    modernToLegacyImports,
    legacyInternalImports,
    cycles,
  };
  return {
    fingerprint: fingerprintArchitectureDebt(payload),
    metrics: {
      legacyNodes: legacyNodes.length,
      modernToLegacyImports: modernToLegacyImports.length,
      legacyInternalImports: legacyInternalImports.length,
      cyclicComponents: cycles.length,
    },
    payload,
  };
};

export const makeComponentCandidates = (analysis, resolvedEdges) => {
  const componentByNode = new Map();
  const batchByComponent = new Map();
  const candidateStateByComponent = new Map();
  for (const [batch, componentIds] of analysis.dependencyFirstBatches.entries()) {
    for (const id of componentIds) batchByComponent.set(id, batch);
  }
  for (const component of analysis.stronglyConnectedComponents) {
    for (const node of component.nodes) componentByNode.set(node, component.id);
    if (component.nodes.some((node) => layerOf(node) === "legacy")) {
      candidateStateByComponent.set(component.id, {
        modernImporters: new Set(),
        legacyImporters: new Set(),
        dependencies: new Set(),
      });
    }
  }

  for (const edge of resolvedEdges) {
    const sourceComponent = componentByNode.get(edge.file);
    const targetComponent = componentByNode.get(edge.target);
    if (sourceComponent === targetComponent) continue;

    const targetState = candidateStateByComponent.get(targetComponent);
    if (targetState) {
      if (layerOf(edge.file) === "modern") targetState.modernImporters.add(edge.file);
      if (layerOf(edge.file) === "legacy") targetState.legacyImporters.add(edge.file);
    }
    const sourceState = candidateStateByComponent.get(sourceComponent);
    if (sourceState && targetComponent !== undefined) {
      sourceState.dependencies.add(targetComponent);
    }
  }

  const candidates = [];
  for (const component of analysis.stronglyConnectedComponents) {
    const state = candidateStateByComponent.get(component.id);
    if (!state) continue;
    candidates.push({
      id: component.id,
      nodes: component.nodes,
      cyclic: component.cyclic,
      dependencyBatch: batchByComponent.get(component.id),
      modernImporterCount: state.modernImporters.size,
      legacyImporterCount: state.legacyImporters.size,
      dependencyCount: state.dependencies.size,
      modernImporters: [...state.modernImporters].sort(compareCodePoint),
    });
  }
  return candidates;
};

const priorityViews = (candidates) => ({
  cycleBreakers: candidates
    .filter(({ cyclic }) => cyclic)
    .sort((left, right) => compareCodePoint(left.id, right.id)),
  dependencyFirst: [...candidates].sort((left, right) =>
    left.dependencyBatch - right.dependencyBatch ||
    right.modernImporterCount - left.modernImporterCount ||
    compareCodePoint(left.id, right.id)),
  modernBlockers: [...candidates].sort((left, right) =>
    right.modernImporterCount - left.modernImporterCount ||
    left.dependencyBatch - right.dependencyBatch ||
    compareCodePoint(left.id, right.id)),
});

const violation = (code, message, details = {}) => ({ code, message, ...details });

export const assembleArchitectureGraphReport = ({
  rawGraph,
  policy,
  plan,
  previousPlan,
  roots = ARCHITECTURE_GRAPH_REPORT_ROOTS,
}) => {
  const validatedPolicy = validateArchitectureGraphPolicy(policy);
  const validatedPlan = validateArchitectureMigrationPlan(plan);
  const resolved = resolveArchitectureModuleGraph(rawGraph);
  const analysis = analyzeDirectedGraph({
    nodes: resolved.nodes,
    edges: resolved.edges.map(({ file, target }) => ({ from: file, to: target })),
  });
  const diagnostics = collectDiagnostics(rawGraph);
  const unresolvedImports = resolved.unresolvedEdges
    .map(({ file, specifier, target }) => ({ file, specifier, target }))
    .sort(compareImports);
  const allowedUnresolvedKeys = new Set(validatedPolicy.allowedUnresolvedImports.map(importKey));
  const actualUnresolvedKeys = new Set(unresolvedImports.map(importKey));
  const unexpectedUnresolved = unresolvedImports.filter((edge) =>
    !allowedUnresolvedKeys.has(importKey(edge)));
  const staleUnresolvedImports = validatedPolicy.allowedUnresolvedImports.filter((edge) =>
    !actualUnresolvedKeys.has(importKey(edge)));

  const cyclicComponents = analysis.stronglyConnectedComponents.filter(({ cyclic }) => cyclic);
  const allowedCycleKeys = new Set(validatedPolicy.allowedCycles.map(cycleKey));
  const actualCycleKeys = new Set(cyclicComponents.map(({ nodes }) => cycleKey(nodes)));
  const unexpectedCycles = cyclicComponents.filter(({ nodes }) => !allowedCycleKeys.has(cycleKey(nodes)));
  const staleCycles = validatedPolicy.allowedCycles.filter((nodes) => !actualCycleKeys.has(cycleKey(nodes)));

  const legacyInternalImports = resolved.edges
    .filter(({ file, target }) =>
      layerOf(file) === "legacy" && layerOf(target) === "legacy")
    .map(({ file, specifier, target }) => ({ file, specifier, target }))
    .sort(compareImports);
  const allowedInternalKeys = new Set(validatedPolicy.allowedLegacyInternalImports.map(importKey));
  const actualInternalKeys = new Set(legacyInternalImports.map(importKey));
  const unexpectedLegacyInternalImports = legacyInternalImports.filter((edge) =>
    !allowedInternalKeys.has(importKey(edge)));
  const staleLegacyInternalImports = validatedPolicy.allowedLegacyInternalImports.filter((edge) =>
    !actualInternalKeys.has(importKey(edge)));

  const debt = buildArchitectureDebtSnapshot({ resolved, analysis });
  const completedLoops = validatedPlan.loops.filter(({ status }) => status === "complete");
  const debtCeiling = completedLoops.at(-1)?.completionEvidence ?? validatedPlan.baselineDebt;
  const activeLoop = validatedPlan.loops.find(({ status }) => status === "in_progress");
  const progressViolations = [];
  if (previousPlan !== undefined) {
    const validatedPreviousPlan = normalizePreviousArchitectureMigrationPlan(
      previousPlan,
      validatedPlan,
    );
    if (JSON.stringify(validatedPlan.baselineDebt) !== JSON.stringify(validatedPreviousPlan.baselineDebt)) {
      progressViolations.push(violation(
        "migration-checkpoint-regression",
        "Výchozí baselineDebt se proti Git baseline nesmí měnit.",
      ));
    }
    const previousCompletedLoops = validatedPreviousPlan.loops.filter(
      ({ status }) => status === "complete",
    );
    for (const [index, previousLoop] of previousCompletedLoops.entries()) {
      const currentLoop = completedLoops[index];
      if (
        currentLoop?.id !== previousLoop.id ||
        JSON.stringify(currentLoop.completionEvidence) !== JSON.stringify(previousLoop.completionEvidence)
      ) {
        progressViolations.push(violation(
          "migration-checkpoint-regression",
          `Dokončená evidence ${previousLoop.id} se proti Git baseline nesmí měnit.`,
        ));
      }
    }
    const newlyCompleted = completedLoops.length - previousCompletedLoops.length;
    if (newlyCompleted < 0 || newlyCompleted > 1) {
      progressViolations.push(violation(
        "migration-checkpoint-regression",
        "Jeden Git krok smí dokončit nejvýše jednu migrační smyčku.",
        { previousComplete: previousCompletedLoops.length, currentComplete: completedLoops.length },
      ));
    }
    if (newlyCompleted > 0 && activeLoop) {
      progressViolations.push(violation(
        "migration-checkpoint-required",
        `Po dokončení smyčky musí vzniknout idle checkpoint před spuštěním ${activeLoop.id}.`,
        { previousComplete: previousCompletedLoops.length, currentComplete: completedLoops.length },
      ));
    }
  }
  if (activeLoop) {
    if (
      completedLoops.length === 0 &&
      (
        !metricsEqual(debt.metrics, debtCeiling.metrics) ||
        debt.fingerprint !== debtCeiling.fingerprint
      )
    ) {
      progressViolations.push(violation(
        "migration-baseline-mismatch",
        "První smyčka musí vycházet z přesného aktuálního legacy baseline.",
        { expected: debtCeiling, actual: { fingerprint: debt.fingerprint, metrics: debt.metrics } },
      ));
    } else if (!metricsDoNotIncrease(debt.metrics, debtCeiling.metrics)) {
      progressViolations.push(violation(
        "migration-debt-regression",
        `${activeLoop.id} zvýšil legacy dluh oproti poslední dokončené evidenci.`,
        { expectedMaximum: debtCeiling.metrics, actual: debt.metrics },
      ));
    }
  } else if (
    !metricsEqual(debt.metrics, debtCeiling.metrics) ||
    debt.fingerprint !== debtCeiling.fingerprint
  ) {
    progressViolations.push(violation(
      "migration-debt-mismatch",
      "Aktuální legacy graf neodpovídá poslední completionEvidence.",
      { expected: debtCeiling, actual: { fingerprint: debt.fingerprint, metrics: debt.metrics } },
    ));
  }
  if (
    completedLoops.length === REQUIRED_PLAN_LOOPS &&
    DEBT_METRIC_KEYS.some((key) => debt.metrics[key] !== 0)
  ) {
    progressViolations.push(violation(
      "legacy-closeout-incomplete",
      "Plán je označen jako dokončený, ale legacy dluh není nulový.",
      { actual: debt.metrics },
    ));
  }
  const remainingLegacyRoots = (rawGraph.existingScanRoots ?? [])
    .filter((scanRoot) => ARCHITECTURE_GRAPH_LEGACY_ROOTS.includes(scanRoot))
    .sort(compareCodePoint);
  if (completedLoops.length === REQUIRED_PLAN_LOOPS && remainingLegacyRoots.length > 0) {
    progressViolations.push(violation(
      "legacy-closeout-structure-incomplete",
      `Plán je dokončený, ale legacy roots stále existují: ${remainingLegacyRoots.join(", ")}.`,
      { roots: remainingLegacyRoots },
    ));
  }

  const violations = [
    ...diagnostics.map((message) => violation("collection-error", message)),
    ...resolved.ambiguousEdges.map((edge) => violation(
      "ambiguous-import",
      `${edge.file}: ${edge.specifier} má více kandidátů.`,
      { file: edge.file, specifier: edge.specifier, target: edge.target, candidates: edge.candidates },
    )),
    ...unexpectedUnresolved.map((edge) => violation(
      "unexpected-unresolved-import",
      `${edge.file}: ${edge.specifier} nelze rozřešit.`,
      { file: edge.file, specifier: edge.specifier, target: edge.target },
    )),
    ...staleUnresolvedImports.map((edge) => violation(
      "stale-unresolved-import",
      `Povolený unresolved import již není používán: ${edge.file} -> ${edge.target}.`,
      edge,
    )),
    ...unexpectedCycles.map((component) => violation(
      "unexpected-cycle",
      `Nepovolená cyklická komponenta: ${component.nodes.join(", ")}.`,
      { nodes: component.nodes },
    )),
    ...staleCycles.map((nodes) => violation(
      "stale-cycle",
      `Povolený cyklus již neexistuje: ${nodes.join(", ")}.`,
      { nodes },
    )),
    ...unexpectedLegacyInternalImports.map((edge) => violation(
      "unexpected-legacy-internal-import",
      `Nepovolený interní legacy import: ${edge.file} -> ${edge.target}.`,
      edge,
    )),
    ...staleLegacyInternalImports.map((edge) => violation(
      "stale-legacy-internal-import",
      `Povolený interní legacy import již neexistuje: ${edge.file} -> ${edge.target}.`,
      edge,
    )),
    ...progressViolations,
  ];

  const candidates = makeComponentCandidates(analysis, resolved.edges);
  const modules = analysis.nodes.map((node) => ({ ...node, layer: layerOf(node.id) }));
  const imports = resolved.edges.map(({ file, target, rawTarget, specifier, kind }) => ({
    from: file,
    to: target,
    requestedTarget: rawTarget,
    specifier,
    kind,
  }));
  const batchByComponent = new Map();
  for (const [batch, ids] of analysis.dependencyFirstBatches.entries()) {
    for (const id of ids) batchByComponent.set(id, batch);
  }

  return {
    schemaVersion: ARCHITECTURE_GRAPH_REPORT_SCHEMA_VERSION,
    status: violations.length === 0 ? "ok" : "failed",
    scope: {
      roots: [...roots],
      modernRoots: [...ARCHITECTURE_GRAPH_MODERN_ROOTS],
      legacyRoots: [...ARCHITECTURE_GRAPH_LEGACY_ROOTS],
    },
    summary: {
      sourceNodes: resolved.nodes.length,
      rawImports: rawGraph.edges.length,
      resolvedImports: resolved.edges.length,
      unresolvedImports: resolved.unresolvedEdges.length,
      ambiguousImports: resolved.ambiguousEdges.length,
      stronglyConnectedComponents: analysis.stronglyConnectedComponents.length,
      cyclicComponents: cyclicComponents.length,
      dependencyBatches: analysis.dependencyFirstBatches.length,
      legacyNodes: resolved.nodes.filter((node) => layerOf(node) === "legacy").length,
      modernToLegacyImports: resolved.edges.filter(({ file, target }) =>
        layerOf(file) === "modern" && layerOf(target) === "legacy").length,
      legacyInternalImports: legacyInternalImports.length,
    },
    resolution: {
      unresolved: unresolvedImports,
      unexpectedUnresolved,
      staleAllowedImports: staleUnresolvedImports,
      ambiguous: resolved.ambiguousEdges,
    },
    modules,
    imports,
    components: analysis.stronglyConnectedComponents.map((component) => ({
      ...component,
      dependencyBatch: batchByComponent.get(component.id),
    })),
    migrationBatches: analysis.dependencyFirstBatches,
    priorities: priorityViews(candidates),
    debt,
    plan: {
      ...summarizeArchitectureMigrationPlan(validatedPlan),
      loops: validatedPlan.loops,
    },
    violations,
  };
};

export const buildArchitectureGraphReport = ({
  root,
  policy,
  plan,
  previousPlan,
  roots = ARCHITECTURE_GRAPH_REPORT_ROOTS,
  limits,
} = {}) => {
  const rawGraph = collectArchitectureGraph({ root, scanRoots: roots, limits });
  const entrypointDiagnostics = collectProductionEntrypointDiagnostics(root, rawGraph);
  return assembleArchitectureGraphReport({
    rawGraph: {
      ...rawGraph,
      collectionErrors: [...rawGraph.collectionErrors, ...entrypointDiagnostics],
    },
    policy,
    plan,
    previousPlan,
    roots,
  });
};
