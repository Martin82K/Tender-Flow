import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { validateArchitectureMigrationPlan } from "../scripts/lib/architecture-graph-report.mjs";

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
};

describe("architecture migration plan", () => {
  it("defines one contiguous, auditable sequence of sixteen loops", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as { version: number; loops: MigrationLoop[] };

    expect(plan.version).toBe(1);
    expect(plan.loops).toHaveLength(16);
    expect(plan.loops.map(({ id }) => id)).toEqual(
      Array.from({ length: 16 }, (_, index) => `loop-${String(index + 1).padStart(2, "0")}`),
    );
    expect(plan.loops.filter(({ status }) => status === "in_progress")).toHaveLength(1);
    expect(plan.loops.find(({ status }) => status === "in_progress")?.id).toBe("loop-01");

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
    expect(workflow).toContain("npm run check:architecture-graph");
    expect(workflow).toMatch(/branches:\s+[\s\S]*- new_architekt/);
  });

  it("allows a completed prefix to wait for approval before the next loop starts", () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/architecture-migration-plan.json"), "utf8"),
    ) as { version: number; loops: MigrationLoop[] };
    const idle = structuredClone(plan);
    idle.loops[0].status = "complete";
    idle.loops[1].status = "planned";

    expect(validateArchitectureMigrationPlan(idle).loops.slice(0, 2).map(({ status }) => status)).toEqual([
      "complete",
      "planned",
    ]);

    const invalid = structuredClone(idle);
    invalid.loops[2].status = "in_progress";
    expect(() => validateArchitectureMigrationPlan(invalid)).toThrow(/první nedokončená smyčka/i);
  });
});
