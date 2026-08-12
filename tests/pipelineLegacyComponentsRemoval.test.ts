import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("odstranění legacy pipelineComponents", () => {
  it("neponechává legacy adresář ani produkční importy", () => {
    const legacyEntries = readdirSync(join(root, "components"), {
      withFileTypes: true,
    }).filter((entry) => entry.name === "pipelineComponents");

    expect(
      legacyEntries.flatMap((entry) =>
        entry.isDirectory()
          ? readdirSync(join(root, "components", entry.name))
          : [entry.name],
      ),
    ).toEqual([]);

    const pipelineSource = readFileSync(
      join(root, "features/projects/pipeline/Pipeline.tsx"),
      "utf8",
    );
    expect(pipelineSource).not.toMatch(/pipelineComponents/);
  });

  it("zveřejňuje pipeline UI pouze přes feature public API", () => {
    const featureIndex = readFileSync(
      join(root, "features/projects/pipeline/index.ts"),
      "utf8",
    );

    for (const componentName of [
      "BidCard",
      "CategoryCard",
      "CategoryFormModal",
      "Column",
      "CreateContactModal",
      "EditBidModal",
      "PipelineOverview",
      "SubcontractorSelectorModal",
    ]) {
      expect(featureIndex).toContain(`export { ${componentName} }`);
    }
  });
});
