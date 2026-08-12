import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

describe("PipelineOverview module boundary", () => {
  it("owns PipelineOverview in the project feature", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/PipelineOverview.tsx",
    );

    expect(featureSource).toContain("export const PipelineOverview");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?utils\//);
    expect(featureSource).not.toMatch(/from ["']\.\.\/\.\.\/\.\.\//);
  });

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("features/projects/pipeline/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bPipelineOverview\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

});
