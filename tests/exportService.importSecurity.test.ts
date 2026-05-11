import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importTenderPlanFromXLSX } from "../services/exportService";

describe("importTenderPlanFromXLSX security", () => {
  it("odmita prilis velky XLSX soubor pred parsovanim", async () => {
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "plan.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );

    await expect(importTenderPlanFromXLSX(oversized)).rejects.toThrow("příliš velký");
  });

  it("pouziva omezeny XLSX parser bez formuli/html/stylu", () => {
    const source = readFileSync(resolve(process.cwd(), "services/exportService.ts"), "utf-8");

    expect(source).toContain("sheetRows: TENDER_PLAN_IMPORT_MAX_ROWS + 2");
    expect(source).toContain("cellFormula: false");
    expect(source).toContain("cellHTML: false");
    expect(source).toContain("cellStyles: false");
  });
});
