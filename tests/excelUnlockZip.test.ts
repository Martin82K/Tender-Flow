import { describe, expect, it, vi } from "vitest";
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

  it("zachova hodnoty, vzorce a ostatni ZIP polozky pri odemceni vice listu", async () => {
    const workbook = new ExcelJS.Workbook();
    const first = workbook.addWorksheet("Rozpocet");
    first.getCell("A1").value = 42;
    first.getCell("A2").value = { formula: "A1*2", result: 84 };
    first.getCell("A1").font = { bold: true };
    const second = workbook.addWorksheet("Poznamky");
    second.getCell("B2").value = "Příliš žluťoučký kůň";
    await first.protect("test", {});
    await second.protect("test", {});
    const input = new Uint8Array(await workbook.xlsx.writeBuffer() as ArrayBuffer);
    const before = unzipSync(input);
    const result = await unlockExcelZipWithStats(input);
    const after = unzipSync(result.output);

    expect(result.worksheetCount).toBe(2);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const path of Object.keys(before)) {
      if (/^xl\/worksheets\/.+\.xml$/i.test(path)) {
        expect(strFromU8(after[path])).not.toContain("sheetProtection");
      } else {
        expect(after[path]).toEqual(before[path]);
      }
    }
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(result.output as never);
    expect(reopened.worksheets.map((sheet) => sheet.name)).toEqual(["Rozpocet", "Poznamky"]);
    expect(reopened.worksheets[0].getCell("A1").value).toBe(42);
    expect(reopened.worksheets[0].getCell("A1").font.bold).toBe(true);
    expect(reopened.worksheets[0].getCell("A2").value).toEqual({ formula: "A1*2", result: 84 });
    expect(reopened.worksheets[1].getCell("B2").value).toBe("Příliš žluťoučký kůň");
  });

  it("zpracuje Uint8Array s nenulovym offsetem a zachova progress callback", async () => {
    const input = new Uint8Array(await buildProtectedWorkbook());
    const padded = new Uint8Array(input.length + 16);
    padded.set(input, 8);
    const onProgress = vi.fn();
    const result = await unlockExcelZipWithStats(padded.subarray(8, 8 + input.length), { onProgress });
    expect(result.worksheetCount).toBe(1);
    expect(onProgress).toHaveBeenLastCalledWith(95, "Připravuji stažení...");
  });
});
