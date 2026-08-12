import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("number formatter module boundary", () => {
  it("owns number formatting in shared and keeps the legacy path as an adapter", () => {
    const sharedSource = read("shared/formatting/numberFormatters.ts");
    const legacySource = read("utils/formatters.ts");

    expect(sharedSource).toContain("export const formatMoney");
    expect(sharedSource).toContain("export const formatInputNumber");
    expect(legacySource).not.toContain("new Intl.NumberFormat");
    expect(legacySource).toContain(
      'from "@/shared/formatting/numberFormatters"',
    );
  });

  it("keeps shared UI and CategoryCard independent of the legacy formatter", () => {
    const consumers = [
      "shared/ui/AnimatedCounter.tsx",
      "shared/ui/NumericInput.tsx",
      "shared/ui/SubcontractorSelector.tsx",
      "features/projects/pipeline/ui/CategoryCard.tsx",
    ];

    for (const consumer of consumers) {
      expect(read(consumer), consumer).not.toMatch(
        /from ["'](?:@\/|\.\.\/)+utils\/formatters["']/,
      );
    }
  });
});
