import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readPipeline = () =>
  readFileSync(
    join(process.cwd(), "features/projects/pipeline/Pipeline.tsx"),
    "utf8",
  );

describe("Pipeline legacy noise boundary", () => {
  it("neobsahuje mrtvé importy, proměnné ani placeholder komentáře", () => {
    const source = readPipeline();

    expect(source).not.toContain(
      'import { SubcontractorSelector } from "./SubcontractorSelector"',
    );
    expect(source).not.toContain(
      'import { formatInputNumber } from "../utils/formatters"',
    );
    expect(source).not.toMatch(/^\s*CategoryCard,\s*$/m);
    expect(source).not.toContain("const isDesktopMode");
    expect(source).not.toContain("existing code omitted for brevity");
    expect(source).not.toContain("inside the render, look for EditBidModal");
  });
});
