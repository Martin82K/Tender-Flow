import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CategoryFormModal as legacyCategoryFormModal } from "@/components/pipelineComponents/CategoryFormModal";
import { CategoryFormModal as featureCategoryFormModal } from "@features/projects/pipeline";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Pipeline CategoryFormModal module boundary", () => {
  it("vlastní implementaci ve feature a legacy cestu drží pouze jako adapter", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/CategoryFormModal.tsx",
    );
    const legacySource = read(
      "components/pipelineComponents/CategoryFormModal.tsx",
    );

    expect(featureSource).toContain("export const CategoryFormModal");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(legacySource.trim()).toBe(
      [
        'export { CategoryFormModal } from "@features/projects/pipeline";',
        'export type { CategoryFormData, CategoryFormModalProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("skládá Pipeline přes veřejný feature modul", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bCategoryFormModal\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("zachová identitu legacy exportu", () => {
    expect(legacyCategoryFormModal).toBe(featureCategoryFormModal);
  });
});
