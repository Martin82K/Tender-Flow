import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { mergeWorkbookToSingleSheet } from "../server/excel_tools_api/src/merge";
import {
  hasValidAuth,
  isOriginAllowed,
  sanitizeDownloadFilename,
  shouldRequireAuth,
} from "../server/excel_tools_api/src/securityCore";

const writeWorkbook = async (workbook: ExcelJS.Workbook): Promise<Buffer> => {
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
};

describe("excel tools api security helpers", () => {
  it("vyžaduje bearer nebo x-api-key podle env konfigurace", () => {
    const env = {
      EXCEL_TOOLS_API_KEY: "secret-token",
    };

    expect(shouldRequireAuth(env)).toBe(true);
    expect(hasValidAuth({}, env)).toBe(false);
    expect(hasValidAuth({ authorization: "Bearer secret-token" }, env)).toBe(true);
    expect(hasValidAuth({ "x-api-key": "secret-token" }, env)).toBe(true);
    expect(hasValidAuth({ authorization: "Bearer wrong" }, env)).toBe(false);
  });

  it("omezuje CORS na allowlist a nepovolí libovolný origin", () => {
    const env = {
      EXCEL_TOOLS_ALLOWED_ORIGINS: "https://app.example.com,http://localhost:3000",
    };

    expect(isOriginAllowed("https://app.example.com", env)).toBe(true);
    expect(isOriginAllowed("https://evil.example", env)).toBe(false);
    expect(isOriginAllowed(undefined, env)).toBe(true);
  });

  it("sanitizuje název souboru pro Content-Disposition", () => {
    expect(sanitizeDownloadFilename('../nebezpecny"\r\nSet-Cookie: x=.xlsx', "_combined_final.xlsx")).toBe(
      "nebezpecny_Set-Cookie_x_combined_final.xlsx",
    );
  });
});

describe("excel merge workbook guards", () => {
  it("nepřenáší nebezpečné externí formule do výstupního workbooku", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    sheet.getCell("A1").value = {
      formula: 'HYPERLINK("https://evil.example","klik")',
      result: "klik",
    };
    sheet.getCell("A2").value = {
      formula: "SUM(1,2)",
      result: 3,
    };

    const merged = await mergeWorkbookToSingleSheet(await writeWorkbook(workbook));
    const output = new ExcelJS.Workbook();
    await output.xlsx.load(merged as any);
    const outSheet = output.getWorksheet("Kombinovane");

    expect(outSheet?.getCell("B3").value).toBe("klik");
    expect(outSheet?.getCell("B4").value).toMatchObject({
      formula: "SUM(1,2)",
      result: 3,
    });
  });

  it("odmítne workbook mimo nastavené limity", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("One").getCell("A1").value = "x";
    workbook.addWorksheet("Two").getCell("A1").value = "x";

    await expect(
      mergeWorkbookToSingleSheet(await writeWorkbook(workbook), { maxWorksheets: 1 }),
    ).rejects.toThrow(/too many worksheets/i);
  });
});
