import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BidCard as legacyBidCard } from "@/components/pipelineComponents/BidCard";
import { BidCard as featureBidCard } from "@features/projects/pipeline";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline BidCard module boundary", () => {
  it("owns BidCard in the project feature and keeps the legacy path as an adapter", () => {
    const featureSource = read("features/projects/pipeline/ui/BidCard.tsx");
    const legacySource = read("components/pipelineComponents/BidCard.tsx");

    expect(featureSource).toContain("export const BidCard");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
    expect(legacySource.trim()).toBe(
      [
        'export { BidCard } from "@features/projects/pipeline";',
        'export type { BidCardProps } from "@features/projects/pipeline";',
      ].join("\n"),
    );
  });

  it("routes the Pipeline composition through the feature-owned BidCard", () => {
    const pipelineSource = read("components/Pipeline.tsx");

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bBidCard\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
  });

  it("preserves the legacy export identity", () => {
    expect(legacyBidCard).toBe(featureBidCard);
  });
});
