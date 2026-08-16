import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assembleArchitectureGraphReport,
  buildArchitectureDebtSnapshot,
  validateArchitectureMigrationPlan,
} from "../scripts/lib/architecture-graph-report.mjs";
import { collectArchitectureGraph } from "../scripts/lib/architecture-graph.mjs";

type LoopStatus = "planned" | "in_progress" | "complete";
type MigrationLoop = {
  id: string;
  title: string;
  status: LoopStatus;
  objective: string;
  dependencies: string[];
  exitCriteria: string[];
  riskChecks: string[];
  testGates: string[];
  completionEvidence?: DebtEvidence;
};

type DebtEvidence = {
  fingerprint: string;
  metrics: {
    legacyNodes: number;
    modernToLegacyImports: number;
    legacyInternalImports: number;
    cyclicComponents: number;
  };
};

type MigrationPlan = { version: number; baselineDebt: DebtEvidence; loops: MigrationLoop[] };

let repositoryRawGraph: ReturnType<typeof collectArchitectureGraph>;

beforeAll(() => {
  repositoryRawGraph = collectArchitectureGraph({ root: process.cwd() });
}, 15_000);

describe("architecture migration plan", () => {
  it("counts modern cycles in the final zero-debt contract", () => {
    const snapshot = buildArchitectureDebtSnapshot({
      resolved: {
        nodes: ["app/a.ts", "app/b.ts"],
        edges: [],
      },
      analysis: {
        stronglyConnectedComponents: [
          { id: "component-0001", nodes: ["app/a.ts", "app/b.ts"], cyclic: true },
        ],
      },
    });

    expect(snapshot.metrics.cyclicComponents).toBe(1);
    expect(snapshot.payload.cycles).toEqual([["app/a.ts", "app/b.ts"]]);
  });

  it("defines one contiguous, auditable sequence of sixteen loops", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as MigrationPlan;

    expect(plan.version).toBe(2);
    expect(plan.baselineDebt).toEqual({
      fingerprint: "sha256:497d50e607a31d63b105bbb6caacdd669f26b3c5b5fe5704ec32f29763ada338",
      metrics: {
        legacyNodes: 113,
        modernToLegacyImports: 135,
        legacyInternalImports: 137,
        cyclicComponents: 1,
      },
    });
    expect(plan.loops).toHaveLength(16);
    expect(plan.loops.map(({ id }) => id)).toEqual(
      Array.from({ length: 16 }, (_, index) => `loop-${String(index + 1).padStart(2, "0")}`),
    );
    expect(plan.loops.filter(({ status }) => status === "in_progress")).toHaveLength(0);
    expect(plan.loops[0]).toMatchObject({
      id: "loop-01",
      status: "complete",
      completionEvidence: plan.baselineDebt,
    });

    const knownIds = new Set<string>();
    for (const loop of plan.loops) {
      expect(["planned", "in_progress", "complete"]).toContain(loop.status);
      expect(loop.title.trim()).not.toBe("");
      expect(loop.objective.trim()).not.toBe("");
      expect(loop.exitCriteria.length).toBeGreaterThan(0);
      expect(loop.riskChecks.length).toBeGreaterThan(0);
      expect(loop.testGates.length).toBeGreaterThan(0);
      expect(loop.dependencies.every((dependency) => knownIds.has(dependency))).toBe(true);
      knownIds.add(loop.id);
    }

    const closeout = plan.loops.at(-1)!;
    const closeoutContract = [
      ...closeout.exitCriteria,
      ...closeout.riskChecks,
      ...closeout.testGates,
    ].join(" ").toLowerCase();
    for (const requirement of ["legacy roots", "legacy import", "cykl", "electron", "security"]) {
      expect(closeoutContract).toContain(requirement);
    }
  });

  it("wires the graph gate into package scripts and CI for the integration branch", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/quality.yml"),
      "utf8",
    );

    expect(packageJson.scripts["architecture:graph"]).toBe("node scripts/report-architecture-graph.mjs");
    expect(packageJson.scripts["check:architecture-graph"]).toBe(
      "node scripts/report-architecture-graph.mjs --check",
    );
    expect(workflow).toContain("node scripts/report-architecture-graph.mjs --check");
    expect(workflow).toContain("ARCHITECTURE_GRAPH_BASELINE_REF:");
    expect(workflow).toContain("--final-integration");
    expect(workflow).toContain("github.base_ref == 'main'");
    expect(workflow).toContain("github.head_ref == 'new_architekt'");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain("--post-merge-integration");
    expect(workflow).toContain("ARCHITECTURE_GRAPH_BASELINE_REF: ${{ github.event.before }}");
    expect(workflow).toMatch(/branches:\s+[\s\S]*- new_architekt/);
  });

  it("allows a completed prefix to wait for approval before the next loop starts", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as MigrationPlan;
    const idle = structuredClone(plan);
    idle.loops[0].status = "complete";
    idle.loops[0].completionEvidence = structuredClone(plan.baselineDebt);
    idle.loops[1].status = "planned";

    expect(validateArchitectureMigrationPlan(idle).loops.slice(0, 2).map(({ status }) => status)).toEqual([
      "complete",
      "planned",
    ]);

    const policy = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-graph-policy.json"), "utf8"),
    );
    expect(assembleArchitectureGraphReport({ rawGraph: repositoryRawGraph, policy, plan: idle }).status).toBe("ok");

    const wrongFingerprint = structuredClone(idle);
    wrongFingerprint.loops[0].completionEvidence!.fingerprint = `sha256:${"0".repeat(64)}`;
    expect(
      assembleArchitectureGraphReport({ rawGraph: repositoryRawGraph, policy, plan: wrongFingerprint }).violations,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "migration-debt-mismatch" }),
    ]));

    const invalid = structuredClone(idle);
    invalid.loops[2].status = "in_progress";
    expect(() => validateArchitectureMigrationPlan(invalid)).toThrow(/první nedokončená smyčka/i);
  });

  it("requires an idle checkpoint before the next loop may start", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as MigrationPlan;
    const policy = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-graph-policy.json"), "utf8"),
    );
    const previousPlan = structuredClone(plan);
    previousPlan.loops[0].status = "in_progress";
    delete previousPlan.loops[0].completionEvidence;
    const currentPlan = structuredClone(plan);
    currentPlan.loops[1].status = "in_progress";
    const report = assembleArchitectureGraphReport({
      rawGraph: repositoryRawGraph,
      policy,
      plan: currentPlan,
      previousPlan,
    });

    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "migration-checkpoint-required" }),
    ]));

    const rewrittenBaseline = structuredClone(plan);
    rewrittenBaseline.baselineDebt.fingerprint = `sha256:${"0".repeat(64)}`;
    expect(assembleArchitectureGraphReport({
      rawGraph: repositoryRawGraph,
      policy,
      plan: rewrittenBaseline,
      previousPlan: plan,
    }).violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "migration-checkpoint-regression" }),
    ]));
  });

  it("accepts only the original version 1 plan as a one-time checkpoint migration", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as MigrationPlan;
    const policy = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-graph-policy.json"), "utf8"),
    );
    const previousV1 = {
      version: 1,
      __trustedSourceDigest: "cfa1b32c58c7bcb692f010b9782c2f4131e836ac09ab124fcfb1bb48852d6901",
      loops: plan.loops.map((loop, index) => ({
        ...loop,
        status: index === 0 ? "in_progress" : "planned",
        completionEvidence: undefined,
      })),
    };

    expect(assembleArchitectureGraphReport({
      rawGraph: repositoryRawGraph,
      policy,
      plan,
      previousPlan: previousV1,
    }).status).toBe("ok");

    previousV1.loops[0].status = "complete";
    expect(() => assembleArchitectureGraphReport({
      rawGraph: repositoryRawGraph,
      policy,
      plan,
      previousPlan: previousV1,
    })).toThrow(/plan v1 lze migrovat jen/);
  });

  it("rejects fake completion without measured monotonic debt evidence", () => {
    const root = process.cwd();
    const plan = JSON.parse(
      fs.readFileSync(path.join(root, "config/architecture-migration-plan.json"), "utf8"),
    ) as MigrationPlan;
    const policy = JSON.parse(
      fs.readFileSync(path.join(root, "config/architecture-graph-policy.json"), "utf8"),
    );

    const missingEvidence = structuredClone(plan);
    missingEvidence.loops[0].status = "complete";
    delete missingEvidence.loops[0].completionEvidence;
    expect(() => validateArchitectureMigrationPlan(missingEvidence)).toThrow(/completionEvidence/);

    const noReduction = structuredClone(plan);
    noReduction.loops[0].status = "complete";
    noReduction.loops[0].completionEvidence = structuredClone(plan.baselineDebt);
    noReduction.loops[1].status = "complete";
    noReduction.loops[1].completionEvidence = structuredClone(plan.baselineDebt);
    expect(() => validateArchitectureMigrationPlan(noReduction)).toThrow(/měřitelný pokles/);

    const fakeComplete = structuredClone(plan);
    let previous = structuredClone(plan.baselineDebt);
    for (const [index, loop] of fakeComplete.loops.entries()) {
      loop.status = "complete";
      const isFirst = index === 0;
      const isLast = index === fakeComplete.loops.length - 1;
      const metrics = isLast
        ? { legacyNodes: 0, modernToLegacyImports: 0, legacyInternalImports: 0, cyclicComponents: 0 }
        : {
            ...previous.metrics,
            legacyNodes: isFirst ? previous.metrics.legacyNodes : previous.metrics.legacyNodes - 1,
          };
      loop.completionEvidence = {
        fingerprint: `sha256:${String(index + 1).padStart(64, "0")}`,
        metrics,
      };
      previous = loop.completionEvidence;
    }

    const report = assembleArchitectureGraphReport({
      rawGraph: repositoryRawGraph,
      policy,
      plan: fakeComplete,
    });
    expect(report.status).toBe("failed");
    expect(report.violations.map(({ code }: { code: string }) => code)).toEqual(
      expect.arrayContaining(["migration-debt-mismatch", "legacy-closeout-incomplete"]),
    );
  });
});
