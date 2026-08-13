import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Pipeline contact modal boundary", () => {
  it("vlastní modal ve feature modulu", () => {
    const featureIndex = readSource("features/projects/pipeline/index.ts");
    const pipeline = readSource("features/projects/pipeline/Pipeline.tsx");
    const contactModals = readSource(
      "features/projects/pipeline/ui/PipelineContactModals.tsx",
    );

    expect(featureIndex).toContain(
      'export { CreateContactModal } from "./ui/CreateContactModal"',
    );
    expect(featureIndex).toContain(
      'export type { CreateContactModalProps } from "./ui/CreateContactModal"',
    );
    expect(featureIndex).toContain(
      'export { PipelineContactModals } from "./ui/PipelineContactModals"',
    );
    expect(pipeline).toContain("PipelineContactModals,");
    expect(pipeline).not.toContain("<CreateContactModal");
    expect(contactModals).toContain(
      'import { CreateContactModal } from "./CreateContactModal"',
    );
    expect(contactModals).toContain("<CreateContactModal");
  });
});
