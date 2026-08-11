import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Column as legacyColumn } from "@/components/pipelineComponents/Column";
import { Column as featureColumn } from "@features/projects/pipeline";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline Column module boundary", () => {
  it("owns Column in the project feature and keeps the legacy path as an adapter", () => {
    const featureSource = read("features/projects/pipeline/ui/Column.tsx");
    const legacySource = read("components/pipelineComponents/Column.tsx");

    expect(featureSource).toContain("export const Column");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(legacySource.trim()).toBe(
      [
        'export { Column } from "@features/projects/pipeline";',
        'export type { ColumnProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("routes the Pipeline composition through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bColumn\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("preserves the legacy export identity", () => {
    expect(legacyColumn).toBe(featureColumn);
  });
});
