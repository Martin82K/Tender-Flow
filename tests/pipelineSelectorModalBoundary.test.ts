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
    const pipelineSource = read("features/projects/pipeline/Pipeline.tsx");
    const contactModalsSource = read(
      "features/projects/pipeline/ui/PipelineContactModals.tsx",
    );

    expect(pipelineSource).toContain("PipelineContactModals,");
    expect(pipelineSource).not.toContain("<SubcontractorSelectorModal");
    expect(contactModalsSource).toContain(
      'import { SubcontractorSelectorModal } from "./SubcontractorSelectorModal"',
    );
    expect(contactModalsSource).toContain("<SubcontractorSelectorModal");
  });

});
