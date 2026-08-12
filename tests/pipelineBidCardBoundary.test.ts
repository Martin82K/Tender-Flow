import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Pipeline BidCard module boundary", () => {
  it("owns BidCard in the project feature", () => {
    const featureSource = read("features/projects/pipeline/ui/BidCard.tsx");

    expect(featureSource).toContain("export const BidCard");
    expect(featureSource).not.toMatch(/from ["'](?:@\/)?components\//);
  });

  it("routes the Pipeline composition through the feature-owned BidCard", () => {
    const pipelineSource = read("components/Pipeline.tsx");
    const boardSource = read(
      "features/projects/pipeline/ui/PipelineKanbanBoard.tsx",
    );

    expect(pipelineSource).toMatch(
      /import\s*{[^}]*\bPipelineKanbanBoard\b[^}]*}\s*from\s*["']@features\/projects\/pipeline["'];/,
    );
    expect(pipelineSource).not.toMatch(/\bBidCard\b/);
    expect(boardSource).toContain('import { BidCard } from "./BidCard";');
  });

});
