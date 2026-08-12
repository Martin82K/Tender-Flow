import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PipelineOverview as LegacyPipelineOverview } from "@/components/pipelineComponents/PipelineOverview";
import { PipelineOverview as FeaturePipelineOverview } from "@features/projects/pipeline";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

describe("PipelineOverview module boundary", () => {
  it("owns PipelineOverview in the project feature and keeps the legacy path as an adapter", () => {
    const featureSource = read(
      "features/projects/pipeline/ui/PipelineOverview.tsx",
    );
    const legacySource = read(
      "components/pipelineComponents/PipelineOverview.tsx",
    );

    expect(featureSource).toContain("export const PipelineOverview");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?utils\//);
    expect(featureSource).not.toMatch(/from ["']\.\.\/\.\.\/\.\.\//);
    expect(legacySource.trim()).toBe(
      [
        'export { PipelineOverview } from "@features/projects/pipeline";',
        'export type { PipelineOverviewProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("routes Pipeline through the public feature module", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bPipelineOverview\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("keeps the legacy export compatible with the feature implementation", () => {
    expect(LegacyPipelineOverview).toBe(FeaturePipelineOverview);
  });
});
