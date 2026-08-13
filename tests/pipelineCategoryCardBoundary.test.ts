import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline CategoryCard module boundary", () => {
  it("owns CategoryCard in the project feature", () => {
    const featureSource = read("features/projects/pipeline/ui/CategoryCard.tsx");

    expect(featureSource).toContain("export const CategoryCard");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
  });

  it("keeps CategoryCard behind PipelineOverview", () => {
    const pipelineSource = read("features/projects/pipeline/Pipeline.tsx");
    const overviewSource = read(
      "features/projects/pipeline/ui/PipelineOverview.tsx",
    );

    expect(pipelineSource).toContain("PipelineOverview,");
    expect(pipelineSource).not.toMatch(/^\s*CategoryCard,\s*$/m);
    expect(pipelineSource).not.toContain("<CategoryCard");
    expect(overviewSource).toContain("import { CategoryCard } from './CategoryCard'");
    expect(overviewSource).toContain("<CategoryCard");
  });

});
