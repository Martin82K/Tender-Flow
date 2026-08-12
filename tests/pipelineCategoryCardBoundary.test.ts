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

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bCategoryCard\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

});
