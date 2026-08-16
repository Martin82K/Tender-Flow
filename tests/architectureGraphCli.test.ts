import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import { fingerprintArchitectureDebt } from "../scripts/lib/architecture-graph-report.mjs";

const root = process.cwd();
const cli = path.join(root, "scripts/report-architecture-graph.mjs");

type DebtPayload = {
  legacyNodes: string[];
  modernToLegacyImports: Array<{ file: string; specifier: string; target: string }>;
  legacyInternalImports: Array<{ file: string; specifier: string; target: string }>;
  cycles: string[][];
};

const debtEvidence = (payload: DebtPayload) => ({
  fingerprint: fingerprintArchitectureDebt(payload),
  metrics: {
    legacyNodes: payload.legacyNodes.length,
    modernToLegacyImports: payload.modernToLegacyImports.length,
    legacyInternalImports: payload.legacyInternalImports.length,
    cyclicComponents: payload.cycles.length,
  },
});

const emptyDebt: DebtPayload = {
  legacyNodes: [],
  modernToLegacyImports: [],
  legacyInternalImports: [],
  cycles: [],
};

const createPlan = (baselineDebt = debtEvidence(emptyDebt)) => ({
  version: 2,
  baselineDebt,
  loops: Array.from({ length: 16 }, (_, index) => ({
    id: `loop-${String(index + 1).padStart(2, "0")}`,
    title: `Loop ${index + 1}`,
    status: index === 0 ? "in_progress" : "planned",
    objective: "Ověřit migrační krok.",
    dependencies: index === 0 ? [] : [`loop-${String(index).padStart(2, "0")}`],
    exitCriteria: ["Měřitelný dluh neklesá skrytě."],
    riskChecks: ["Bezpečnostní review."],
    testGates: ["Focused a full test suite."],
  })),
});

const writePlan = (fixture: string, plan = createPlan()) => {
  fs.writeFileSync(
    path.join(fixture, "config/architecture-migration-plan.json"),
    `${JSON.stringify(plan, null, 2)}\n`,
  );
};

const createFixture = () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-graph-cli-"));
  for (const directory of ["app", "features", "shared", "infra", "config"]) {
    fs.mkdirSync(path.join(fixture, directory), { recursive: true });
  }
  fs.writeFileSync(
    path.join(fixture, "app/root.ts"),
    'import "@features/a";\nimport type { Root } from "@/types";\nvoid 0;\n',
  );
  fs.writeFileSync(path.join(fixture, "features/a.ts"), 'import "@shared/api";\n');
  fs.writeFileSync(path.join(fixture, "shared/api.ts"), 'import "@infra/client";\n');
  fs.writeFileSync(path.join(fixture, "infra/client.ts"), "export const client = true;\n");
  fs.writeFileSync(
    path.join(fixture, "config/architecture-graph-policy.json"),
    `${JSON.stringify({
      version: 1,
      allowedUnresolvedImports: [
        { file: "app/root.ts", specifier: "@/types", target: "types" },
      ],
      allowedCycles: [],
      allowedLegacyInternalImports: [],
    }, null, 2)}\n`,
  );
  writePlan(fixture);
  return fixture;
};

const runCli = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [cli, ...args], {
  cwd,
  encoding: "utf8",
});

describe("architecture graph CLI", () => {
  it("emits a deterministic JSON report and dependency-first batches", () => {
    const fixture = createFixture();
    try {
      const first = runCli(fixture, "--json", "--check");
      const second = runCli(fixture, "--json", "--check");

      expect(first.status).toBe(0);
      expect(first.stderr).toBe("");
      expect(second.stdout).toBe(first.stdout);
      const report = JSON.parse(first.stdout) as Record<string, any>;
      expect(report.schemaVersion).toBe(1);
      expect(report.status).toBe("ok");
      expect(report.scope.roots).toEqual([
        "index.tsx", "App.tsx", "app", "features", "shared", "infra",
        "components", "hooks", "services", "context", "utils",
      ]);
      expect(report.summary).toMatchObject({
        sourceNodes: 4,
        rawImports: 4,
        resolvedImports: 3,
        unresolvedImports: 1,
        ambiguousImports: 0,
        stronglyConnectedComponents: 4,
        cyclicComponents: 0,
        dependencyBatches: 4,
        legacyNodes: 0,
        modernToLegacyImports: 0,
        legacyInternalImports: 0,
      });
      expect(report.resolution.unresolved).toEqual([
        expect.objectContaining({ file: "app/root.ts", specifier: "@/types", target: "types" }),
      ]);
      expect(report.resolution.unexpectedUnresolved).toEqual([]);
      expect(report.resolution.ambiguous).toEqual([]);
      expect(report.migrationBatches).toEqual([
        ["infra/client.ts"],
        ["shared/api.ts"],
        ["features/a.ts"],
        ["app/root.ts"],
      ]);
      expect(report.plan).toMatchObject({ total: 16, complete: 0, inProgress: "loop-01" });
      expect(first.stdout).not.toContain(fixture);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("fails closed for unexpected unresolved source imports", () => {
    const fixture = createFixture();
    try {
      fs.appendFileSync(path.join(fixture, "app/root.ts"), 'import "@shared/missing";\n');
      const result = runCli(fixture, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Nečekaně nerozřešené zdrojové importy:");
      expect(result.stderr).toContain("app/root.ts");
      expect(result.stderr).toContain("@shared/missing");
      expect(result.stderr).toContain("shared/missing");
      expect(result.stderr).not.toContain(fixture);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("ratchets unresolved imports by exact edge rather than target only", () => {
    const fixture = createFixture();
    try {
      fs.writeFileSync(path.join(fixture, "app/another.ts"), 'import type { Root } from "@/types";\n');
      const result = runCli(fixture, "--check");

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("app/another.ts");
      expect(result.stderr).toContain('"@/types"');
      expect(result.stderr).toContain("types");
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("includes the root composition entrypoint in the modern graph", () => {
    const fixture = createFixture();
    try {
      fs.mkdirSync(path.join(fixture, "services"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "index.tsx"), 'import "@/services/bootstrap";\n');
      fs.writeFileSync(path.join(fixture, "services/bootstrap.ts"), "export {};\n");
      writePlan(fixture, createPlan(debtEvidence({
        legacyNodes: ["services/bootstrap.ts"],
        modernToLegacyImports: [{
          file: "index.tsx",
          specifier: "@/services/bootstrap",
          target: "services/bootstrap.ts",
        }],
        legacyInternalImports: [],
        cycles: [],
      })));

      const result = runCli(fixture, "--json", "--check");
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as Record<string, any>;
      expect(report.summary).toMatchObject({
        sourceNodes: 6,
        resolvedImports: 4,
        modernToLegacyImports: 1,
      });
      expect(report.modules).toContainEqual(
        expect.objectContaining({ id: "index.tsx", layer: "modern" }),
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("fails closed for ambiguous imports and collection diagnostics", () => {
    const ambiguousFixture = createFixture();
    const collectionFixture = createFixture();
    try {
      fs.appendFileSync(path.join(ambiguousFixture, "app/root.ts"), 'import "@shared/ambiguous";\n');
      fs.writeFileSync(path.join(ambiguousFixture, "shared/ambiguous.ts"), "export {};\n");
      fs.writeFileSync(path.join(ambiguousFixture, "shared/ambiguous.tsx"), "export {};\n");
      const ambiguous = runCli(ambiguousFixture, "--check");
      expect(ambiguous.status).toBe(1);
      expect(ambiguous.stdout).toBe("");
      expect(ambiguous.stderr).toContain("Nejednoznačné importy:");
      expect(ambiguous.stderr).toContain("shared/ambiguous.ts, shared/ambiguous.tsx");

      fs.writeFileSync(
        path.join(collectionFixture, "app/root.ts"),
        'const pattern = "@shared/*.ts";\nvoid import.meta.glob(pattern);\n',
      );
      const collection = runCli(collectionFixture, "--check");
      expect(collection.status).toBe(1);
      expect(collection.stdout).toBe("");
      expect(collection.stderr).toContain("Graf nelze bezpečně sestavit:");
      expect(collection.stderr).toContain("import.meta.glob musí používat statický literál");

      fs.writeFileSync(
        path.join(collectionFixture, "app/dynamic.cjs"),
        'const target = "@/services/runtime";\nrequire(target);\n',
      );
      fs.writeFileSync(
        path.join(collectionFixture, "app/root.ts"),
        'import type { Root } from "@/types";\n',
      );
      const dynamicRequire = runCli(collectionFixture, "--check");
      expect(dynamicRequire.status).toBe(1);
      expect(dynamicRequire.stderr).toContain("require musí používat jeden statický literál");

      fs.writeFileSync(
        path.join(collectionFixture, "app/dynamic.cjs"),
        "export {};\n",
      );
      fs.writeFileSync(
        path.join(collectionFixture, "app/dynamic.ts"),
        'const name = "runtime";\nvoid import(`../../services/${name}.ts`);\n',
      );
      const dynamicImport = runCli(collectionFixture, "--check");
      expect(dynamicImport.status).toBe(1);
      expect(dynamicImport.stderr).toContain("import() musí používat jeden statický literál");
    } finally {
      fs.rmSync(ambiguousFixture, { recursive: true, force: true });
      fs.rmSync(collectionFixture, { recursive: true, force: true });
    }
  });

  it("prints a compact human progress report", () => {
    const fixture = createFixture();
    try {
      const result = runCli(fixture, "--check");
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Architecture graph OK");
      expect(result.stdout).toContain("Source nodes: 4");
      expect(result.stdout).toContain("Resolved imports: 3");
      expect(result.stdout).toContain("Unresolved imports: 1 (expected: 1, unexpected: 0)");
      expect(result.stdout).toContain("Legacy: 0 nodes, 0 incoming imports, 0 internal imports");
      expect(result.stdout).toContain("Migration plan: 0/16 complete, loop-01 in progress");
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("keeps diagnostic reporting available while only --check enforces policy", () => {
    const fixture = createFixture();
    try {
      fs.appendFileSync(path.join(fixture, "app/root.ts"), 'import "@shared/missing";\n');
      const diagnostic = runCli(fixture);
      const gate = runCli(fixture, "--check");

      expect(diagnostic.status).toBe(0);
      expect(diagnostic.stdout).toContain("Architecture graph FAILED");
      expect(diagnostic.stdout).toContain("Source nodes: 4");
      expect(diagnostic.stderr).toContain("Nečekaně nerozřešené zdrojové importy:");
      expect(gate.status).toBe(1);
      expect(gate.stdout).toBe("");
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("orders transparent migration priorities by dependencies and modern importers", () => {
    const fixture = createFixture();
    try {
      fs.mkdirSync(path.join(fixture, "services"), { recursive: true });
      fs.appendFileSync(
        path.join(fixture, "app/root.ts"),
        'import "@/services/a";\n',
      );
      fs.appendFileSync(
        path.join(fixture, "features/a.ts"),
        'import "@/services/a";\nimport "@/services/leaf";\n',
      );
      fs.writeFileSync(path.join(fixture, "services/a.ts"), 'import "@/services/b";\n');
      fs.writeFileSync(path.join(fixture, "services/b.ts"), 'import "@/services/a";\n');
      fs.writeFileSync(path.join(fixture, "services/leaf.ts"), "export {};\n");
      fs.writeFileSync(path.join(fixture, "services/parent.ts"), 'import "@/services/leaf";\n');
      writePlan(fixture, createPlan(debtEvidence({
        legacyNodes: [
          "services/a.ts",
          "services/b.ts",
          "services/leaf.ts",
          "services/parent.ts",
        ],
        modernToLegacyImports: [
          { file: "app/root.ts", specifier: "@/services/a", target: "services/a.ts" },
          { file: "features/a.ts", specifier: "@/services/a", target: "services/a.ts" },
          { file: "features/a.ts", specifier: "@/services/leaf", target: "services/leaf.ts" },
        ],
        legacyInternalImports: [
          { file: "services/a.ts", specifier: "@/services/b", target: "services/b.ts" },
          { file: "services/b.ts", specifier: "@/services/a", target: "services/a.ts" },
          { file: "services/parent.ts", specifier: "@/services/leaf", target: "services/leaf.ts" },
        ],
        cycles: [["services/a.ts", "services/b.ts"]],
      })));
      fs.writeFileSync(
        path.join(fixture, "config/architecture-graph-policy.json"),
        `${JSON.stringify({
          version: 1,
          allowedUnresolvedImports: [
            { file: "app/root.ts", specifier: "@/types", target: "types" },
          ],
          allowedCycles: [["services/a.ts", "services/b.ts"]],
          allowedLegacyInternalImports: [
            { file: "services/a.ts", specifier: "@/services/b", target: "services/b.ts" },
            { file: "services/b.ts", specifier: "@/services/a", target: "services/a.ts" },
            { file: "services/parent.ts", specifier: "@/services/leaf", target: "services/leaf.ts" },
          ],
        }, null, 2)}\n`,
      );

      const result = runCli(fixture, "--json", "--check");
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as Record<string, any>;
      expect(report.priorities.cycleBreakers.map(({ id }: { id: string }) => id)).toEqual([
        "services/a.ts",
      ]);
      expect(report.priorities.dependencyFirst.map(({ id }: { id: string }) => id)).toEqual([
        "services/a.ts",
        "services/leaf.ts",
        "services/parent.ts",
      ]);
      expect(report.priorities.modernBlockers.map(({ id }: { id: string }) => id)).toEqual([
        "services/a.ts",
        "services/leaf.ts",
        "services/parent.ts",
      ]);
      expect(report.priorities.modernBlockers).toEqual([
        expect.objectContaining({
          id: "services/a.ts",
          nodes: ["services/a.ts", "services/b.ts"],
          cyclic: true,
          modernImporterCount: 2,
          legacyImporterCount: 0,
        }),
        expect.objectContaining({
          id: "services/leaf.ts",
          modernImporterCount: 1,
          legacyImporterCount: 1,
        }),
        expect.objectContaining({
          id: "services/parent.ts",
          modernImporterCount: 0,
          dependencyCount: 1,
        }),
      ]);
      expect(report.modules.filter(({ id }: { id: string }) => id.startsWith("services/"))).toEqual([
        { id: "services/a.ts", fanIn: 3, fanOut: 1, layer: "legacy" },
        { id: "services/b.ts", fanIn: 1, fanOut: 1, layer: "legacy" },
        { id: "services/leaf.ts", fanIn: 2, fanOut: 0, layer: "legacy" },
        { id: "services/parent.ts", fanIn: 0, fanOut: 1, layer: "legacy" },
      ]);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("rejects new cycles, internal legacy imports and stale policy entries", () => {
    const cycleFixture = createFixture();
    const legacyFixture = createFixture();
    const staleFixture = createFixture();
    try {
      fs.appendFileSync(path.join(cycleFixture, "infra/client.ts"), 'import "@app/root";\n');
      const cycle = runCli(cycleFixture, "--check");
      expect(cycle.status).toBe(1);
      expect(cycle.stderr).toContain("Architecture graph policy není aktuální:");
      expect(cycle.stderr).toContain("Nepovolená cyklická komponenta");

      fs.mkdirSync(path.join(legacyFixture, "services"), { recursive: true });
      fs.writeFileSync(path.join(legacyFixture, "services/a.ts"), 'import "@/services/b";\n');
      fs.writeFileSync(path.join(legacyFixture, "services/b.ts"), "export {};\n");
      const legacy = runCli(legacyFixture, "--check");
      expect(legacy.status).toBe(1);
      expect(legacy.stderr).toContain("Nepovolený interní legacy import");
      expect(legacy.stderr).toContain("services/a.ts -> services/b.ts");

      fs.writeFileSync(path.join(staleFixture, "app/root.ts"), 'import "@features/a";\n');
      const stale = runCli(staleFixture, "--check");
      expect(stale.status).toBe(1);
      expect(stale.stderr).toContain("Povolený unresolved import již není používán");
    } finally {
      fs.rmSync(cycleFixture, { recursive: true, force: true });
      fs.rmSync(legacyFixture, { recursive: true, force: true });
      fs.rmSync(staleFixture, { recursive: true, force: true });
    }
  });

  it("rejects invalid configuration as a contract error", () => {
    const fixture = createFixture();
    try {
      fs.writeFileSync(path.join(fixture, "config/architecture-graph-policy.json"), "{}\n");
      const result = runCli(fixture, "--check");
      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Neplatný kontrakt architektonického grafu:");
      expect(result.stderr).not.toContain(fixture);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("ratchets the current repository graph and its only known cycle", () => {
    const result = runCli(root, "--json", "--check");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout) as Record<string, any>;
    expect(report.summary).toEqual({
      sourceNodes: 599,
      rawImports: 1752,
      resolvedImports: 1467,
      unresolvedImports: 285,
      ambiguousImports: 0,
      stronglyConnectedComponents: 597,
      cyclicComponents: 1,
      dependencyBatches: 24,
      legacyNodes: 113,
      modernToLegacyImports: 135,
      legacyInternalImports: 137,
    });
    expect(report.components.filter(({ cyclic }: { cyclic: boolean }) => cyclic)).toEqual([
      expect.objectContaining({
        nodes: [
          "services/authSessionService.ts",
          "services/incidentLogger.ts",
          "services/supabase.ts",
        ],
      }),
    ]);
    expect(report.violations).toEqual([]);
  });
});
