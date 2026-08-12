import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline SubcontractorSelectorModal module boundary", () => {
  it("owns the modal in the project feature", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/SubcontractorSelectorModal.tsx",
    );

    expect(featureSource).toContain("export const SubcontractorSelectorModal");
    expect(featureSource).toContain(
      'import { SubcontractorSelector } from "@shared/ui/SubcontractorSelector";',
    );
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
  });

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bSubcontractorSelectorModal\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

});
