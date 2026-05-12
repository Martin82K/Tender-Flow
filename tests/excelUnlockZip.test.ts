import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  unlockExcelZip,
  unlockExcelZipWithStats,
} from "@/shared/tools/excel/excelUnlockZip";
import { unlockExcelZipWithStats as unlockExcelZipWithStatsFromLegacy } from "../utils/excelUnlockZip";

const buildProtectedWorkbook = async (): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("List1");
  sheet.getCell("A1").value = "Hodnota";
  await sheet.protect("tajne", {});
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
};

describe("excelUnlockZip", () => {
  it("odstrani sheetProtection ze vsech worksheet XML souboru", async () => {
    const input = await buildProtectedWorkbook();

    const result = await unlockExcelZipWithStats(input);
    const zip = unzipSync(result.output);
    const worksheetPaths = Object.keys(zip).filter((path) =>
      /^xl\/worksheets\/.+\.xml$/i.test(path),
    );

    expect(result.worksheetCount).toBe(1);
    expect(worksheetPaths).toHaveLength(1);
    expect(strFromU8(zip[worksheetPaths[0]])).not.toContain("sheetProtection");
  });

  it("zachova legacy entrypoint a vraci odemceny vystup", async () => {
    const input = await buildProtectedWorkbook();

    const result = await unlockExcelZipWithStatsFromLegacy(input);
    const output = await unlockExcelZip(input);

    expect(result.worksheetCount).toBe(1);
    expect(output.length).toBeGreaterThan(0);
  });

  it("odmitne archiv bez worksheet XML souboru", async () => {
    const input = zipSync({ "[Content_Types].xml": strToU8("<Types></Types>") });

    await expect(unlockExcelZipWithStats(input)).rejects.toThrow(
      /worksheet XML/,
    );
  });
});
