import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Pipeline contact modal boundary", () => {
  it("vlastní modal ve feature modulu a zachovává tenký legacy re-export", () => {
    const featureIndex = readSource("features/projects/pipeline/index.ts");
    const pipeline = readSource("components/Pipeline.tsx");
    const legacyShim = readSource(
      "components/pipelineComponents/CreateContactModal.tsx",
    );

    expect(featureIndex).toContain(
      'export { CreateContactModal } from "./ui/CreateContactModal"',
    );
    expect(featureIndex).toContain(
      'export type { CreateContactModalProps } from "./ui/CreateContactModal"',
    );
    expect(pipeline).toMatch(
      /import \{[\s\S]*CreateContactModal[\s\S]*\} from "@features\/projects\/pipeline"/,
    );
    expect(legacyShim).toBe(
      'export { CreateContactModal } from "@features/projects/pipeline";\n' +
        'export type { CreateContactModalProps } from "@features/projects/pipeline";\n',
    );
  });
});
