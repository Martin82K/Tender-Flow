import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Pipeline CategoryFormModal module boundary", () => {
  it("vlastní implementaci ve feature", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/CategoryFormModal.tsx",
    );

    expect(featureSource).toContain("export const CategoryFormModal");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
  });

  it("skládá Pipeline přes veřejný feature modul", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bCategoryFormModal\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

});
