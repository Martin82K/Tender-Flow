import { describe, expect, it } from "vitest";
import type { ContractWithDetails } from "@/types";
import { buildContractTableWorkbook } from "@/services/exportService";

const contract: ContractWithDetails = {
  id: "contract-1",
  projectId: "project-1",
  vendorName: "KLIMA - ELEKTRON s.r.o.",
  title: "Vzduchotechnika",
  contractNumber: "SOD-001",
  status: "active",
  currency: "CZK",
  basePrice: 1_000_000,
  currentTotal: 1_200_000,
  approvedSum: 500_000,
  remaining: 700_000,
  invoicedSum: 450_000,
  paidSum: 300_000,
  overdueSum: 0,
  retentionShortPercent: 5,
  retentionLongPercent: 3,
  warrantyMonths: 24,
  signedAt: "2026-01-15",
  paymentTerms: "21 dní",
  vendorRating: 4,
  source: "manual",
  documentFileName: "smlouva.pdf",
  amendments: [{
    id: "amendment-1",
    contractId: "contract-1",
    amendmentNo: 1,
    deltaPrice: 200_000,
  }],
  drawdowns: [],
  invoices: [],
};

describe("contractTableExport", () => {
  it("vytvoří stylizovaný XLSX přehled s metadaty, filtry a číselnými hodnotami", async () => {
    const workbook = await buildContractTableWorkbook([contract], {
      organizationName: "REKO a.s.",
      projectName: "Rekonstrukce školy",
      exportedBy: "Martin Kalkus",
      exportedAt: new Date("2026-08-10T06:30:00.000Z"),
      appVersion: "1.9.0-beta.14",
      appLogoDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    });

    const sheet = workbook.getWorksheet("Smlouvy");
    expect(sheet).toBeDefined();
    expect(sheet?.getCell("C1").value).toBe("Přehled smluv");
    expect(sheet?.getCell("C2").value).toBe("REKO a.s. · Rekonstrukce školy");
    expect(sheet?.getCell("C3").value).toBe("Export provedl: Martin Kalkus");
    expect(sheet?.getCell("C3").value).not.toContain("@");
    expect(sheet?.getCell("C4").value).toContain("Tender Flow 1.9.0-beta.14");

    expect(sheet?.getCell("A9").value).toBe("Dodavatel");
    expect(sheet?.getCell("A10").value).toBe("KLIMA - ELEKTRON s.r.o.");
    expect(sheet?.getCell("F10").value).toBe(1_200_000);
    expect(sheet?.getCell("G10").value).toBe(200_000);
    expect(sheet?.getCell("J10").value).toBe(5);
    expect(sheet?.getCell("K10").value).toBe(60_000);
    expect(sheet?.getCell("F10").numFmt).toContain("Kč");
    expect(sheet?.getCell("A9").font.bold).toBe(true);
    expect(sheet?.getCell("A9").alignment?.wrapText).toBe(true);
    expect(sheet?.getCell("A10").alignment?.wrapText).toBe(true);
    expect(sheet?.getCell("C10").alignment?.wrapText).toBe(true);
    expect(sheet?.getColumn("N").width).toBeGreaterThanOrEqual(16);
    expect(sheet?.getCell("N10").value).toBeInstanceOf(Date);
    expect(sheet?.getCell("N10").numFmt).toBe("dd.mm.yyyy");
    expect(sheet?.getCell("N10").alignment?.horizontal).toBe("center");
    expect(sheet?.getCell("N10").border?.left?.style).toBe("thin");
    expect(sheet?.getColumn("P").width).toBeGreaterThanOrEqual(14);
    expect(sheet?.getCell("P10").numFmt).toContain("★");
    expect(sheet?.getCell("P10").alignment?.horizontal).toBe("center");
    expect(sheet?.getCell("P10").border?.left?.style).toBe("thin");
    expect(sheet?.autoFilter).toEqual({ from: "A9", to: "Q10" });
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", xSplit: 3, ySplit: 9 });
    expect(sheet?.getImages()).toHaveLength(1);
  });

  it("zapisuje uživatelské texty jako text a ne jako vzorce", async () => {
    const workbook = await buildContractTableWorkbook(
      [{ ...contract, vendorName: '=HYPERLINK("https://attacker.invalid")' }],
      {
        organizationName: "Organizace",
        projectName: "Projekt",
        exportedBy: "Uživatel",
        exportedAt: new Date("2026-08-10T06:30:00.000Z"),
        appVersion: "1.9.0-beta.14",
      },
    );

    const cell = workbook.getWorksheet("Smlouvy")?.getCell("A10");
    expect(cell?.value).toBe("'=HYPERLINK(\"https://attacker.invalid\")");
    expect(cell?.formula).toBeUndefined();
  });
});
