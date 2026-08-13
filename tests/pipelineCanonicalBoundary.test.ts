import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const canonicalPipelinePath = join(
  root,
  "features/projects/pipeline/Pipeline.tsx",
);

describe("Pipeline canonical feature boundary", () => {
  it("owns the Pipeline composition root inside the projects feature", () => {
    expect(existsSync(canonicalPipelinePath)).toBe(true);

    const projectLayout = readFileSync(
      join(root, "features/projects/ProjectLayout.tsx"),
      "utf8",
    );
    expect(projectLayout).toContain(
      'from "@features/projects/pipeline/Pipeline"',
    );
  });

  it("does not retain legacy Pipeline compatibility entrypoints", () => {
    expect(existsSync(join(root, "components/Pipeline.tsx"))).toBe(false);
    expect(existsSync(join(root, "shared/ui/projects/Pipeline.tsx"))).toBe(
      false,
    );
  });
});
