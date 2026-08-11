import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SubcontractorSelectorModal as legacyModal,
} from "@/components/pipelineComponents/SubcontractorSelectorModal";
import { SubcontractorSelectorModal as featureModal } from "@features/projects/pipeline";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline SubcontractorSelectorModal module boundary", () => {
  it("owns the modal in the project feature and keeps the legacy path as an adapter", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/SubcontractorSelectorModal.tsx",
    );
    const legacySource = read(
      "components/pipelineComponents/SubcontractorSelectorModal.tsx",
    );

    expect(featureSource).toContain("export const SubcontractorSelectorModal");
    expect(featureSource).toContain(
      'import { SubcontractorSelector } from "@shared/ui/SubcontractorSelector";',
    );
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(legacySource.trim()).toBe(
      [
        'export { SubcontractorSelectorModal } from "@features/projects/pipeline";',
        'export type { SubcontractorSelectorModalProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bSubcontractorSelectorModal\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("preserves the legacy export identity", () => {
    expect(legacyModal).toBe(featureModal);
  });
});
