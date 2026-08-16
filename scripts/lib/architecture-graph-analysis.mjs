import path from "node:path";

import { ARCHITECTURE_SOURCE_EXTENSIONS } from "./architecture-graph.mjs";

const MAX_NODES = 50_000;
const MAX_RAW_EDGES = 500_000;
const MAX_ID_BYTES = 4_096;
const MAX_TOTAL_INPUT_BYTES = 16 * 1024 * 1024;

const declarationExtensions = Object.freeze([".d.ts", ".d.mts", ".d.cts"]);

const sourceExtensions = new Set(ARCHITECTURE_SOURCE_EXTENSIONS);

const compareCodePoint = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const compareArrays = (left, right) => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = compareCodePoint(left[index], right[index]);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
};

const assertModuleId = (value, label) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} musí být neprázdná cesta modulu.`);
  }
  if (Buffer.byteLength(value, "utf8") > MAX_ID_BYTES) {
    throw new RangeError(`${label} překračuje limit ${MAX_ID_BYTES} bajtů.`);
  }
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").some((segment) => segment === ".." || segment === ".")
  ) {
    throw new TypeError(`${label} musí být kanonická relativní POSIX cesta: ${JSON.stringify(value)}`);
  }
};

const assertCollectionLimits = (nodes, edges) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new TypeError("Graf musí obsahovat pole nodes a edges.");
  }
  if (nodes.length > MAX_NODES) {
    throw new RangeError(`Graf překračuje limit ${MAX_NODES} uzlů.`);
  }
  if (edges.length > MAX_RAW_EDGES) {
    throw new RangeError(`Graf překračuje limit ${MAX_RAW_EDGES} surových hran.`);
  }
};

const sortRawEdges = (edges) => [...edges].sort((left, right) =>
  compareCodePoint(left.file, right.file) ||
  compareCodePoint(left.target, right.target) ||
  compareCodePoint(left.specifier ?? "", right.specifier ?? "") ||
  compareCodePoint(left.kind ?? "", right.kind ?? ""));

const byteLength = (value, label) => {
  if (typeof value !== "string") throw new TypeError(`${label} musí být řetězec.`);
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > MAX_ID_BYTES) {
    throw new RangeError(`${label} překračuje limit ${MAX_ID_BYTES} bajtů.`);
  }
  return bytes;
};

const assertTotalInputBytes = (totalBytes) => {
  if (totalBytes > MAX_TOTAL_INPUT_BYTES) {
    throw new RangeError(`Graf překračuje celkový limit ${MAX_TOTAL_INPUT_BYTES} bajtů vstupu.`);
  }
};

export const resolveArchitectureModuleGraph = ({ nodes, edges }) => {
  assertCollectionLimits(nodes, edges);

  const moduleIds = [];
  const moduleSet = new Set();
  let totalBytes = 0;
  for (const node of nodes) {
    const moduleId = typeof node === "string" ? node : node?.file;
    assertModuleId(moduleId, "ID uzlu");
    if (moduleSet.has(moduleId)) {
      throw new TypeError(`Duplicitní uzel grafu: ${moduleId}`);
    }
    moduleSet.add(moduleId);
    moduleIds.push(moduleId);
    totalBytes += Buffer.byteLength(moduleId, "utf8");
  }
  assertTotalInputBytes(totalBytes);
  moduleIds.sort(compareCodePoint);

  const validatedTargets = new Set();
  for (const edge of edges) {
    assertModuleId(edge?.file, "Zdroj hrany");
    if (!validatedTargets.has(edge?.target)) {
      assertModuleId(edge?.target, "Cíl hrany");
      validatedTargets.add(edge.target);
    }
    if (!moduleSet.has(edge.file)) {
      throw new TypeError(`Hrana odkazuje na neznámý zdrojový uzel ${JSON.stringify(edge.file)}.`);
    }
    totalBytes += byteLength(edge.specifier, "Specifier hrany");
    totalBytes += byteLength(edge.kind, "Druh hrany");
    if (edge.kind !== "static" && edge.kind !== "glob") {
      throw new TypeError(`Neznámý druh hrany ${JSON.stringify(edge.kind)}.`);
    }
    totalBytes += Buffer.byteLength(edge.file, "utf8") + Buffer.byteLength(edge.target, "utf8");
    assertTotalInputBytes(totalBytes);
  }

  const resolvedEdges = [];
  const unresolvedEdges = [];
  const ambiguousEdges = [];

  for (const edge of sortRawEdges(edges)) {
    const candidates = [];
    if (edge.kind === "glob") {
      if (moduleSet.has(edge.target)) candidates.push(edge.target);
    } else if (edge.kind === "static") {
      if (moduleSet.has(edge.target)) candidates.push(edge.target);
      if (!sourceExtensions.has(path.posix.extname(edge.target))) {
        for (const extension of [...declarationExtensions, ...ARCHITECTURE_SOURCE_EXTENSIONS]) {
          const fileCandidate = `${edge.target}${extension}`;
          const indexCandidate = `${edge.target}/index${extension}`;
          if (moduleSet.has(fileCandidate)) candidates.push(fileCandidate);
          if (moduleSet.has(indexCandidate)) candidates.push(indexCandidate);
        }
      }
    }

    const uniqueCandidates = [...new Set(candidates)].sort(compareCodePoint);
    if (uniqueCandidates.length === 1) {
      resolvedEdges.push({ ...edge, rawTarget: edge.target, target: uniqueCandidates[0] });
    } else if (uniqueCandidates.length === 0) {
      unresolvedEdges.push({ ...edge });
    } else {
      ambiguousEdges.push({ ...edge, candidates: uniqueCandidates });
    }
  }

  return {
    nodes: moduleIds,
    edges: sortRawEdges(resolvedEdges),
    unresolvedEdges: sortRawEdges(unresolvedEdges),
    ambiguousEdges: sortRawEdges(ambiguousEdges),
  };
};

const prepareDirectedGraph = ({ nodes, edges }) => {
  assertCollectionLimits(nodes, edges);

  const nodeSet = new Set();
  let totalBytes = 0;
  for (const node of nodes) {
    assertModuleId(node, "ID uzlu");
    if (nodeSet.has(node)) throw new TypeError(`Duplicitní uzel grafu: ${node}`);
    nodeSet.add(node);
    totalBytes += Buffer.byteLength(node, "utf8");
  }
  assertTotalInputBytes(totalBytes);
  const sortedNodes = [...nodeSet].sort(compareCodePoint);
  const outgoing = new Map(sortedNodes.map((node) => [node, new Set()]));
  const incoming = new Map(sortedNodes.map((node) => [node, new Set()]));

  for (const edge of edges) {
    if (typeof edge?.from !== "string" || typeof edge?.to !== "string") {
      throw new TypeError("Konce hrany musí být řetězce.");
    }
    if (!nodeSet.has(edge.from)) {
      throw new TypeError(`Hrana odkazuje na neznámý zdrojový uzel ${JSON.stringify(edge.from)}.`);
    }
    if (!nodeSet.has(edge.to)) {
      throw new TypeError(`Hrana odkazuje na neznámý cílový uzel ${JSON.stringify(edge.to)}.`);
    }
    totalBytes += Buffer.byteLength(edge.from, "utf8") + Buffer.byteLength(edge.to, "utf8");
    assertTotalInputBytes(totalBytes);
    outgoing.get(edge.from).add(edge.to);
    incoming.get(edge.to).add(edge.from);
  }

  const sortedOutgoing = new Map(sortedNodes.map((node) => [
    node,
    [...outgoing.get(node)].sort(compareCodePoint),
  ]));
  const sortedIncoming = new Map(sortedNodes.map((node) => [
    node,
    [...incoming.get(node)].sort(compareCodePoint),
  ]));

  return { sortedNodes, outgoing, incoming, sortedOutgoing, sortedIncoming };
};

const findComponents = ({ sortedNodes, outgoing, sortedOutgoing, sortedIncoming }) => {
  const visited = new Set();
  const finishOrder = [];

  for (const start of sortedNodes) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack = [{ node: start, nextIndex: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = sortedOutgoing.get(frame.node);
      if (frame.nextIndex < neighbors.length) {
        const neighbor = neighbors[frame.nextIndex];
        frame.nextIndex += 1;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push({ node: neighbor, nextIndex: 0 });
        }
      } else {
        finishOrder.push(frame.node);
        stack.pop();
      }
    }
  }

  const assigned = new Set();
  const componentMembers = [];
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index];
    if (assigned.has(start)) continue;
    assigned.add(start);
    const members = [];
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop();
      members.push(node);
      for (const neighbor of sortedIncoming.get(node)) {
        if (!assigned.has(neighbor)) {
          assigned.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    members.sort(compareCodePoint);
    componentMembers.push(members);
  }
  componentMembers.sort(compareArrays);

  return componentMembers.map((members) => ({
    id: members[0],
    nodes: members,
    cyclic: members.length > 1 || outgoing.get(members[0]).has(members[0]),
  }));
};

const buildCondensation = (components, outgoing) => {
  const componentByNode = new Map();
  for (const component of components) {
    for (const node of component.nodes) componentByNode.set(node, component.id);
  }

  const outgoingComponents = new Map(components.map(({ id }) => [id, new Set()]));
  const importersByDependency = new Map(components.map(({ id }) => [id, new Set()]));
  for (const [source, dependencies] of outgoing) {
    const sourceComponent = componentByNode.get(source);
    for (const dependency of dependencies) {
      const targetComponent = componentByNode.get(dependency);
      if (sourceComponent === targetComponent || outgoingComponents.get(sourceComponent).has(targetComponent)) {
        continue;
      }
      outgoingComponents.get(sourceComponent).add(targetComponent);
      importersByDependency.get(targetComponent).add(sourceComponent);
    }
  }

  const condensationEdges = [];
  for (const [from, targets] of outgoingComponents) {
    for (const to of targets) condensationEdges.push({ from, to });
  }
  condensationEdges.sort((left, right) =>
    compareCodePoint(left.from, right.from) || compareCodePoint(left.to, right.to));

  return { condensationEdges, outgoingComponents, importersByDependency };
};

const buildDependencyFirstBatches = (components, outgoingComponents, importersByDependency) => {
  const remainingOutdegree = new Map(
    components.map(({ id }) => [id, outgoingComponents.get(id).size]),
  );
  let ready = components
    .map(({ id }) => id)
    .filter((id) => remainingOutdegree.get(id) === 0)
    .sort(compareCodePoint);
  const processed = new Set();
  const batches = [];

  while (ready.length > 0) {
    const batch = ready;
    batches.push(batch);
    ready = [];

    for (const dependencyId of batch) {
      processed.add(dependencyId);
      for (const importerId of importersByDependency.get(dependencyId)) {
        const nextOutdegree = remainingOutdegree.get(importerId) - 1;
        remainingOutdegree.set(importerId, nextOutdegree);
        if (nextOutdegree === 0) ready.push(importerId);
      }
    }
    ready.sort(compareCodePoint);
  }

  if (processed.size !== components.length) {
    throw new Error("Kondenzační graf obsahuje cyklus a nelze vytvořit migrační dávky.");
  }
  return batches;
};

export const analyzeDirectedGraph = (graph) => {
  const prepared = prepareDirectedGraph(graph);
  const stronglyConnectedComponents = findComponents(prepared);
  const { condensationEdges, outgoingComponents, importersByDependency } = buildCondensation(
    stronglyConnectedComponents,
    prepared.outgoing,
  );

  return {
    nodes: prepared.sortedNodes.map((id) => ({
      id,
      fanIn: prepared.incoming.get(id).size,
      fanOut: prepared.outgoing.get(id).size,
    })),
    stronglyConnectedComponents,
    condensationEdges,
    dependencyFirstBatches: buildDependencyFirstBatches(
      stronglyConnectedComponents,
      outgoingComponents,
      importersByDependency,
    ),
  };
};
