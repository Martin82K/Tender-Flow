import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CategoryCard as LegacyCategoryCard } from "@/components/pipelineComponents/CategoryCard";
import { CategoryCard as FeatureCategoryCard } from "@features/projects/pipeline";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline CategoryCard module boundary", () => {
  it("owns CategoryCard in the project feature and keeps the legacy path as an adapter", () => {
    const featureSource = read("features/projects/pipeline/ui/CategoryCard.tsx");
    const legacySource = read("components/pipelineComponents/CategoryCard.tsx");

    expect(featureSource).toContain("export const CategoryCard");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(legacySource.trim()).toBe(
      [
        'export { CategoryCard } from "@features/projects/pipeline";',
        'export type { CategoryCardProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bCategoryCard\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("keeps the legacy export compatible with the feature implementation", () => {
    expect(LegacyCategoryCard).toBe(FeatureCategoryCard);
  });
});
