import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  bestPrefixMatch,
  normalizeCode,
} from "@/shared/tools/excel/indexMatcher";
import { normalizeCode as normalizeCodeFromLegacy } from "../utils/indexMatcher";
import { fillOddily } from "@/shared/tools/excel/fillOddily";

const writeWorkbook = async (workbook: ExcelJS.Workbook): Promise<ArrayBuffer> =>
  (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

describe("excel indexer helpers", () => {
  it("normalizuje ciselne kody z hodnot bunek", () => {
    expect(normalizeCode(311236101)).toBe("311236101");
    expect(normalizeCode(" 311236101 ")).toBe("311236101");
    expect(normalizeCode({ result: "311236101" })).toBe("311236101");
    expect(normalizeCode({ richText: [{ text: "311" }, { text: "236" }] })).toBe("311236");
    expect(normalizeCode("31A")).toBeNull();
    expect(normalizeCodeFromLegacy("311236101")).toBe("311236101");
  });

  it("preferuje trimestny prefix pred dvoumistnym fallbackem", () => {
    const indexMap = new Map([
      ["31", "Fallback"],
      ["311", "Zemni prace"],
    ]);

    expect(bestPrefixMatch("311236101", indexMap)).toEqual({
      prefix: "311",
      description: "Zemni prace",
    });
    expect(bestPrefixMatch("321", indexMap)).toBeNull();
  });

  it("vyplni oddily do sloupce B podle markeru D", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rozpocet");
    sheet.getCell("A1").value = "Polozka";
    sheet.getCell("F1").value = "Typ";
    sheet.getCell("G1").value = "Oddil";
    sheet.getCell("F2").value = "D";
    sheet.getCell("G2").value = "Zemni prace";
    sheet.getCell("F3").value = "P";

    const result = await fillOddily(await writeWorkbook(workbook));
    const output = new ExcelJS.Workbook();
    await output.xlsx.load(result.outputBuffer);
    const outputSheet = output.getWorksheet("Rozpocet");

    expect(outputSheet?.getCell("B1").value).toBe("Oddíly");
    expect(outputSheet?.getCell("B2").value).toBe("Zemni prace");
    expect(outputSheet?.getCell("B3").value).toBe("Zemni prace");
    expect(result.stats.sectionsFound).toBe(1);
    expect(result.stats.rowsFilled).toBe(2);
  });
});
