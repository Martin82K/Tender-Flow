import { describe, expect, it } from "vitest";

import {
  analyzeDirectedGraph,
  resolveArchitectureModuleGraph,
} from "../scripts/lib/architecture-graph-analysis.mjs";
import {
  ARCHITECTURE_SOURCE_EXTENSIONS,
  collectArchitectureGraph,
  matchesSupportedGlob,
} from "../scripts/lib/architecture-graph.mjs";

describe("architecture graph analysis", () => {
  it("computes unique fan metrics and dependency-first migration batches", () => {
    const analysis = analyzeDirectedGraph({
      nodes: ["features/report.ts", "shared/api.ts", "infra/client.ts", "shared/free.ts"],
      edges: [
        { from: "features/report.ts", to: "shared/api.ts" },
        { from: "features/report.ts", to: "shared/api.ts" },
        { from: "features/report.ts", to: "infra/client.ts" },
        { from: "shared/api.ts", to: "infra/client.ts" },
      ],
    });

    expect(analysis.nodes).toEqual([
      { id: "features/report.ts", fanIn: 0, fanOut: 2 },
      { id: "infra/client.ts", fanIn: 2, fanOut: 0 },
      { id: "shared/api.ts", fanIn: 1, fanOut: 1 },
      { id: "shared/free.ts", fanIn: 0, fanOut: 0 },
    ]);
    expect(analysis.condensationEdges).toEqual([
      { from: "features/report.ts", to: "infra/client.ts" },
      { from: "features/report.ts", to: "shared/api.ts" },
      { from: "shared/api.ts", to: "infra/client.ts" },
    ]);
    expect(analysis.dependencyFirstBatches).toEqual([
      ["infra/client.ts", "shared/free.ts"],
      ["shared/api.ts"],
      ["features/report.ts"],
    ]);
  });

  it("keeps cycles atomic and recognizes a self-loop", () => {
    const analysis = analyzeDirectedGraph({
      nodes: [
        "features/a.ts",
        "features/b.ts",
        "infra/dependency.ts",
        "shared/self.ts",
        "app/root.ts",
      ],
      edges: [
        { from: "features/a.ts", to: "features/b.ts" },
        { from: "features/b.ts", to: "features/a.ts" },
        { from: "features/b.ts", to: "infra/dependency.ts" },
        { from: "shared/self.ts", to: "shared/self.ts" },
        { from: "app/root.ts", to: "features/a.ts" },
        { from: "app/root.ts", to: "shared/self.ts" },
      ],
    });

    expect(analysis.stronglyConnectedComponents).toEqual([
      {
        id: "app/root.ts",
        nodes: ["app/root.ts"],
        cyclic: false,
      },
      {
        id: "features/a.ts",
        nodes: ["features/a.ts", "features/b.ts"],
        cyclic: true,
      },
      {
        id: "infra/dependency.ts",
        nodes: ["infra/dependency.ts"],
        cyclic: false,
      },
      {
        id: "shared/self.ts",
        nodes: ["shared/self.ts"],
        cyclic: true,
      },
    ]);
    expect(analysis.condensationEdges).toEqual([
      { from: "app/root.ts", to: "features/a.ts" },
      { from: "app/root.ts", to: "shared/self.ts" },
      { from: "features/a.ts", to: "infra/dependency.ts" },
    ]);
    expect(analysis.dependencyFirstBatches).toEqual([
      ["infra/dependency.ts", "shared/self.ts"],
      ["features/a.ts"],
      ["app/root.ts"],
    ]);
  });

  it("is deterministic regardless of node and edge input order", () => {
    const graph = {
      nodes: ["z.ts", "a.ts", "m.ts"],
      edges: [
        { from: "z.ts", to: "m.ts" },
        { from: "m.ts", to: "a.ts" },
      ],
    };
    const reversed = {
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    };

    expect(analyzeDirectedGraph(reversed)).toEqual(analyzeDirectedGraph(graph));
  });

  it("resolves concrete source modules without changing raw collector edges", () => {
    const rawEdges = [
      { file: "app/a.ts", target: "shared/exact.ts", specifier: "@shared/exact.ts", kind: "static" },
      { file: "app/a.ts", target: "shared/extension", specifier: "@shared/extension", kind: "static" },
      { file: "app/a.ts", target: "shared/directory", specifier: "@shared/directory", kind: "static" },
      { file: "app/a.ts", target: "shared/types.contract", specifier: "@shared/types.contract", kind: "static" },
      { file: "app/a.ts", target: "shared/glob.ts", specifier: "@shared/*.ts", kind: "glob" },
      { file: "app/a.ts", target: "shared/ambiguous", specifier: "@shared/ambiguous", kind: "static" },
      { file: "app/a.ts", target: "types", specifier: "@/types", kind: "static" },
    ] as const;
    const rawSnapshot = structuredClone(rawEdges);

    const resolved = resolveArchitectureModuleGraph({
      nodes: [
        { file: "app/a.ts" },
        { file: "shared/exact.ts" },
        { file: "shared/extension.ts" },
        { file: "shared/directory/index.ts" },
        { file: "shared/types.contract.d.ts" },
        { file: "shared/glob.ts" },
        { file: "shared/ambiguous.ts" },
        { file: "shared/ambiguous.tsx" },
      ],
      edges: rawEdges,
    });

    expect(resolved.edges.map(({ file, target }) => ({ file, target }))).toEqual([
      { file: "app/a.ts", target: "shared/directory/index.ts" },
      { file: "app/a.ts", target: "shared/exact.ts" },
      { file: "app/a.ts", target: "shared/extension.ts" },
      { file: "app/a.ts", target: "shared/glob.ts" },
      { file: "app/a.ts", target: "shared/types.contract.d.ts" },
    ]);
    expect(resolved.ambiguousEdges).toEqual([
      expect.objectContaining({
        file: "app/a.ts",
        target: "shared/ambiguous",
        candidates: ["shared/ambiguous.ts", "shared/ambiguous.tsx"],
      }),
    ]);
    expect(resolved.unresolvedEdges).toEqual([
      expect.objectContaining({ file: "app/a.ts", target: "types" }),
    ]);
    expect(rawEdges).toEqual(rawSnapshot);
    expect(
      resolveArchitectureModuleGraph({
        nodes: [...resolved.nodes].reverse(),
        edges: [...rawEdges].reverse(),
      }),
    ).toEqual(resolved);

    expect(() =>
      resolveArchitectureModuleGraph({
        nodes: [{ file: "app/a.ts" }, { file: "shared/a.ts" }],
        edges: [{
          file: "app/a.ts",
          target: "shared/a.ts",
          specifier: "a".repeat(4_097),
          kind: "static",
        }],
      }),
    ).toThrow(/Specifier hrany překračuje limit 4096 bajtů/);
  });

  it("applies TypeScript source substitutions for explicit JavaScript extensions", () => {
    const rawEdges = [
      { file: "app/a.ts", target: "shared/worker.js", specifier: "@shared/worker.js", kind: "static" },
      { file: "app/a.ts", target: "shared/view.jsx", specifier: "@shared/view.jsx", kind: "static" },
      { file: "app/a.ts", target: "shared/module.mjs", specifier: "@shared/module.mjs", kind: "static" },
      { file: "app/a.ts", target: "shared/module.cjs", specifier: "@shared/module.cjs", kind: "static" },
      { file: "app/a.ts", target: "shared/ambiguous.js", specifier: "@shared/ambiguous.js", kind: "static" },
      { file: "app/a.ts", target: "shared/missing.js", specifier: "@shared/missing.js", kind: "static" },
    ] as const;
    const rawSnapshot = structuredClone(rawEdges);
    const nodes = [
      { file: "app/a.ts" },
      { file: "shared/worker.ts" },
      { file: "shared/view.tsx" },
      { file: "shared/module.mts" },
      { file: "shared/module.cts" },
      { file: "shared/ambiguous.js" },
      { file: "shared/ambiguous.ts" },
    ];
    const resolved = resolveArchitectureModuleGraph({
      nodes,
      edges: rawEdges,
    });

    expect(resolved.edges.map(({ target }) => target)).toEqual([
      "shared/module.cts",
      "shared/module.mts",
      "shared/view.tsx",
      "shared/worker.ts",
    ]);
    expect(resolved.unresolvedEdges).toEqual([
      expect.objectContaining({ target: "shared/missing.js" }),
    ]);
    expect(resolved.ambiguousEdges).toEqual([
      expect.objectContaining({
        target: "shared/ambiguous.js",
        candidates: ["shared/ambiguous.js", "shared/ambiguous.ts"],
      }),
    ]);
    expect(rawEdges).toEqual(rawSnapshot);
    expect(resolveArchitectureModuleGraph({
      nodes: [...nodes].reverse(),
      edges: [...rawEdges].reverse(),
    })).toEqual(resolved);
  });

  it("handles a long chain iteratively and rejects incomplete graphs", () => {
    const nodes = Array.from({ length: 20_000 }, (_, index) => `features/n${index}.ts`);
    const edges = nodes.slice(0, -1).map((node, index) => ({
      from: node,
      to: nodes[index + 1],
    }));

    const analysis = analyzeDirectedGraph({ nodes, edges });
    expect(analysis.stronglyConnectedComponents).toHaveLength(20_000);
    expect(analysis.dependencyFirstBatches[0]).toEqual(["features/n19999.ts"]);
    expect(analysis.dependencyFirstBatches.at(-1)).toEqual(["features/n0.ts"]);

    expect(() =>
      analyzeDirectedGraph({
        nodes: ["features/a.ts"],
        edges: [{ from: "features/a.ts", to: "shared/missing.ts" }],
      }),
    ).toThrow(/neznámý cílový uzel .*shared\/missing\.ts/);

    expect(() =>
      analyzeDirectedGraph({ nodes: new Array(50_001).fill("features/a.ts"), edges: [] }),
    ).toThrow(/limit 50000 uzlů/);
    expect(() =>
      analyzeDirectedGraph({ nodes: [`features/${"a".repeat(4_097)}.ts`], edges: [] }),
    ).toThrow(/limit 4096 bajtů/);
    expect(() =>
      resolveArchitectureModuleGraph({
        nodes: Array.from(
          { length: 4_200 },
          (_, index) => `features/${index}-${"a".repeat(4_070)}.ts`,
        ),
        edges: [],
      }),
    ).toThrow(/celkový limit 16777216 bajtů vstupu/);

    expect(
      analyzeDirectedGraph({
        nodes: ["__proto__.ts", "constructor.ts"],
        edges: [{ from: "__proto__.ts", to: "constructor.ts" }],
      }).dependencyFirstBatches,
    ).toEqual([["constructor.ts"], ["__proto__.ts"]]);

    expect(() =>
      analyzeDirectedGraph({ nodes: ["features/\nspoof.ts"], edges: [] }),
    ).toThrow(/"features\/\\nspoof\.ts"/);
  });

  it("analyzes the complete graph induced by the configured source roots", () => {
    const rawGraph = collectArchitectureGraph({ root: process.cwd() });
    const resolvedGraph = resolveArchitectureModuleGraph(rawGraph);
    const analysis = analyzeDirectedGraph({
      nodes: resolvedGraph.nodes,
      edges: resolvedGraph.edges.map(({ file, target }) => ({ from: file, to: target })),
    });

    expect(rawGraph.collectionErrors).toEqual([]);
    expect(rawGraph.nodes).toHaveLength(609);
    expect(rawGraph.edges).toHaveLength(1_822);
    expect(resolvedGraph.edges).toHaveLength(1_533);
    expect(resolvedGraph.unresolvedEdges).toHaveLength(289);
    const unresolvedCategories = resolvedGraph.unresolvedEdges.reduce<Record<string, number>>(
      (categories, { target }) => {
        const category = target === "types"
          ? "types"
          : target.startsWith("config/")
            ? "config"
            : target.startsWith("assets/")
              ? "assets"
              : target.startsWith("fonts/")
                ? "fonts"
                : target.startsWith("public/")
                  ? "public"
                  : target.endsWith(".css")
                    ? "css"
                    : "unexpected";
        categories[category] = (categories[category] ?? 0) + 1;
        return categories;
      },
      {},
    );
    expect(unresolvedCategories).toEqual({
      assets: 20,
      config: 50,
      css: 12,
      fonts: 1,
      public: 1,
      types: 205,
    });
    expect(
      resolvedGraph.unresolvedEdges.filter(({ target }) =>
        [...ARCHITECTURE_SOURCE_EXTENSIONS, ".d.ts", ".d.mts", ".d.cts"]
          .some((extension) => target.endsWith(extension)),
      ),
    ).toEqual([]);
    expect(resolvedGraph.ambiguousEdges).toEqual([]);
    expect(analysis.stronglyConnectedComponents).toHaveLength(607);
    expect(analysis.stronglyConnectedComponents.filter(({ cyclic }) => cyclic)).toEqual([
      {
        id: "services/authSessionService.ts",
        nodes: [
          "services/authSessionService.ts",
          "services/incidentLogger.ts",
          "services/supabase.ts",
        ],
        cyclic: true,
      },
    ]);
    expect(analysis.dependencyFirstBatches).toHaveLength(22);
  }, 20_000);

  it("stops graph collection before an edge expansion can exceed its budget", () => {
    const rawGraph = collectArchitectureGraph({
      root: process.cwd(),
      limits: { maxRawEdges: 1 },
    });

    expect(rawGraph.collectionErrors).toContain(
      "Graf překračuje limit 1 surových hran.",
    );
    expect(rawGraph.edges.length).toBeLessThanOrEqual(1);
  });

  it("matches adversarial glob patterns within a bounded time", () => {
    const repetitions = 14;
    const pattern = `${"a*".repeat(repetitions)}b`;
    const target = `${"a".repeat(repetitions * 2)}c`;
    const startedAt = performance.now();

    expect(matchesSupportedGlob(target, pattern)).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
