import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const auditScript = path.join(root, "scripts/audit-architecture-debt.mjs");
const boundaryScript = path.join(root, "scripts/check-boundaries.mjs");

type ArchitectureEdge = {
  file: string;
  kind: "glob" | "static";
  specifier: string;
  target: string;
};

const compareEdge = (left: ArchitectureEdge, right: ArchitectureEdge) =>
  `${left.file}\0${left.specifier}\0${left.target}`.localeCompare(
    `${right.file}\0${right.specifier}\0${right.target}`,
  );

const expectedEdges: ArchitectureEdge[] = [
  {
    file: "shared/ui/LegacyShim.ts",
    kind: "static",
    specifier: "@components/LegacyButton",
    target: "components/LegacyButton",
  },
  {
    file: "features/demo/consumer.js",
    kind: "static",
    specifier: "@/services/jsdocService",
    target: "services/jsdocService",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "static",
    specifier: "@/services/dynamicService",
    target: "services/dynamicService",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "static",
    specifier: "@/services/exportService",
    target: "services/exportService",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "glob",
    specifier: "@/services/glob*.ts",
    target: "services/globService.ts",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "static",
    specifier: "@/services/importTypeService",
    target: "services/importTypeService",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "static",
    specifier: "@/services/staticService",
    target: "services/staticService",
  },
  {
    file: "features/demo/consumer.ts",
    kind: "static",
    specifier: "@/services/typeService",
    target: "services/typeService",
  },
].sort(compareEdge);
const expectedAuditEdges = expectedEdges
  .filter((edge) => edge.file.startsWith("features/"))
  .map(({ file, specifier, target }) => ({ file, specifier, target }));

const createFixture = () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-architecture-graph-"));
  fs.mkdirSync(path.join(fixtureRoot, "features/demo"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "shared/ui"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "components"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });

  fs.writeFileSync(
    path.join(fixtureRoot, "features/demo/consumer.ts"),
    [
      'import { staticValue } from "@/services/staticService";',
      'export { exportedValue } from "@/services/exportService";',
      'import type { TypeOnly } from "@/services/typeService";',
      'type Imported = import("@/services/importTypeService").Imported;',
      'const load = () => import("@/services/dynamicService");',
      'const glob = import.meta.glob("@/services/glob*.ts");',
      'const example = \'import("@/services/stringOnly")\';',
      '// Example: import("@/services/commentOnly")',
      "void staticValue; void load; void glob; void example;",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "features/demo/consumer.js"),
    [
      '/** @import { JSDocValue } from "@/services/jsdocService" */',
      '/* Example: import("@/services/commentOnly") */',
      "export const value = 1;",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "shared/ui/LegacyShim.ts"),
    'export { LegacyButton } from "@components/LegacyButton";\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "components/LegacyButton.ts"),
    "export const LegacyButton = true;\n",
  );

  for (const target of [
    "dynamicService.ts",
    "exportService.ts",
    "globService.ts",
    "importTypeService.ts",
    "jsdocService.ts",
    "staticService.ts",
    "typeService.ts",
  ]) {
    fs.writeFileSync(path.join(fixtureRoot, "services", target), "export const value = true;\n");
  }

  fs.writeFileSync(
    path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
    JSON.stringify({ allowedFindings: [] }),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-import-baseline.json"),
    `${JSON.stringify({
      version: 1,
      allowedImports: expectedEdges.map(({ file, specifier, target }) => ({ file, specifier, target })),
    }, null, 2)}\n`,
  );

  return fixtureRoot;
};

describe("architecture graph resolver", () => {
  it("gives the audit and boundary guard one AST-derived dependency corpus", async () => {
    const fixtureRoot = createFixture();

    try {
      const auditOutput = execFileSync(process.execPath, [auditScript, "--json"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
      const audit = JSON.parse(auditOutput) as {
        dependencyFindings: Record<string, Array<Omit<ArchitectureEdge, "kind">>>;
        sharedUi: { temporaryShims: Array<{ file: string; targets: string[] }> };
      };
      const auditEdges = audit.dependencyFindings["features-to-legacy-services"]
        .sort((left, right) =>
          `${left.file}\0${left.specifier}\0${left.target}`.localeCompare(
            `${right.file}\0${right.specifier}\0${right.target}`,
          ),
        );

      expect(auditEdges).toEqual(expectedAuditEdges);
      expect(audit.dependencyFindings["shared-to-components"]).toEqual([
        {
          file: "shared/ui/LegacyShim.ts",
          specifier: "@components/LegacyButton",
          target: "components/LegacyButton",
        },
      ]);
      expect(audit.sharedUi.temporaryShims).toEqual([
        {
          file: "shared/ui/LegacyShim.ts",
          kind: "legacy-component-reexport",
          targets: ["components/LegacyButton"],
        },
      ]);
      expect(() =>
        execFileSync(process.execPath, [boundaryScript], {
          cwd: fixtureRoot,
          encoding: "utf8",
          stdio: "pipe",
        }),
      ).not.toThrow();

      const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
      const graph = collectArchitectureGraph({ root: fixtureRoot });
      const graphEdges = (graph.edges as ArchitectureEdge[])
        .filter(
          (edge) =>
            /^(?:app|features|shared|infra)\//.test(edge.file) &&
            /^(?:components|hooks|services|context|utils)(?:\/|$)/.test(edge.target),
        )
        .sort(compareEdge);

      expect(graph.collectionErrors).toEqual([]);
      expect(graphEdges).toEqual(expectedEdges);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("fails the audit when the shared graph cannot be collected completely", () => {
    const fixtureRoot = createFixture();

    try {
      fs.writeFileSync(
        path.join(fixtureRoot, "features/demo/consumer.ts"),
        "const pattern = '@/services/*.ts';\nvoid import.meta.glob(pattern);\n",
      );
      const result = spawnSync(process.execPath, [auditScript, "--json"], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Audit architektury nelze bezpečně dokončit:");
      expect(result.stderr).toContain("features/demo/consumer.ts");
      expect(result.stderr).toContain("import.meta.glob musí používat statický literál");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("preserves the exact real-repository modern-to-legacy graph", async () => {
    const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
    const graph = collectArchitectureGraph({ root });
    const baseline = JSON.parse(
      fs.readFileSync(path.join(root, "config/legacy-import-baseline.json"), "utf8"),
    ) as { allowedImports: Array<Omit<ArchitectureEdge, "kind">> };
    const boundaryAllowlist = JSON.parse(
      fs.readFileSync(path.join(root, "config/architecture-boundary-allowlist.json"), "utf8"),
    ) as { allowedFindings: unknown[] };
    const actual = (graph.edges as ArchitectureEdge[])
      .filter(
        (edge) =>
          /^(?:app|features|shared|infra)\//.test(edge.file) &&
          /^(?:components|hooks|services|context|utils)(?:\/|$)/.test(edge.target),
      )
      .map(({ file, specifier, target }) => ({ file, specifier, target }))
      .sort((left, right) =>
        `${left.file}\0${left.specifier}\0${left.target}`.localeCompare(
          `${right.file}\0${right.specifier}\0${right.target}`,
        ),
      );

    expect(graph.collectionErrors).toEqual([]);
    expect(graph.nodes).toHaveLength(605);
    expect(actual).toEqual(baseline.allowedImports);
    expect(actual).toHaveLength(134);
    expect(boundaryAllowlist.allowedFindings).toHaveLength(37);
  }, 20_000);
});
