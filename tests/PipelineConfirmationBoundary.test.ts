import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Pipeline confirmation boundary", () => {
  it("drží confirmation orchestration ve feature modelu nad shared UI", () => {
    const pipelineSource = readSource("features/projects/pipeline/Pipeline.tsx");
    const hookSource = readSource(
      "features/projects/pipeline/model/usePipelineConfirmation.tsx",
    );

    expect(pipelineSource).not.toContain('from "./ConfirmationModal"');
    expect(pipelineSource).toContain("usePipelineConfirmation");
    expect(hookSource).toContain(
      'from "@shared/ui/ConfirmationModal"',
    );
  });
});
