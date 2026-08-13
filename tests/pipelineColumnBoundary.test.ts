import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline Column module boundary", () => {
  it("owns Column in the project feature", () => {
    const featureSource = read("features/projects/pipeline/ui/Column.tsx");

    expect(featureSource).toContain("export const Column");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
  });

  it("routes the Pipeline composition through the public feature module", () => {
    const pipelineSource = read("features/projects/pipeline/Pipeline.tsx");
    const boardSource = read(
      "features/projects/pipeline/ui/PipelineKanbanBoard.tsx",
    );

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bPipelineKanbanBoard\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
    expect(pipelineSource).not.toMatch(/\bColumn\b/);
    expect(boardSource).toContain('import { Column } from "./Column";');
  });

});
