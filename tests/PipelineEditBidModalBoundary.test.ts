import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

const readSource = (relativePath: string): string =>
  readFileSync(resolve(root, relativePath), "utf8");

describe("Pipeline EditBidModal feature boundary", () => {
  it("owns the implementation in the pipeline feature module", () => {
    const featureSource = readSource(
      "features/projects/pipeline/ui/EditBidModal.tsx",
    );

    expect(featureSource).toContain("export const EditBidModal");
  });

  it("imports the modal through the pipeline public API", () => {
    const pipelineSource = readSource("components/Pipeline.tsx");
    expect(pipelineSource).toMatch(
      /import\s*\{[\s\S]*?EditBidModal[\s\S]*?\}\s*from\s*["']@features\/projects\/pipeline["']/,
    );
    expect(pipelineSource).not.toMatch(/pipelineComponents/);
  });

});
