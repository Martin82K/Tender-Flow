import { describe, expect, it } from "vitest";

import {
  buildContractOverviewWorkbook,
  resolveContractOverviewLogoUrl,
  type ContractOverviewExportMeta,
} from "@/features/contracts-overview/api/contractOverviewExport";
import type { ContractOverviewRow } from "@/features/contracts-overview/api/contractOverviewApi";

const overviewRow: ContractOverviewRow = {
  organizationId: "org-1",
  projectId: "project-1",
  projectName: "Stavba Alfa",
  projectStatus: "realization",
  contractId: "contract-1",
  contractPartner: "Dodavatel Alfa",
  contractTitle: "Smlouva o dílo",
  contractNumber: "S-1",
  contractStatus: "active",
  currency: "CZK",
  basePrice: 1_000_000,
  currentTotal: 1_200_000,
  approvedDrawdown: 450_000,
  remainingAmount: 750_000,
  retentionPercent: null,
  retentionShortPercent: 5,
  retentionShortAmount: 60_000,
  retentionShortReleaseOn: null,
  retentionLongPercent: 3,
  retentionLongAmount: 36_000,
  retentionLongReleaseOn: null,
  warrantyMonths: 24,
  warrantyEnd: "2028-01-15",
  warrantyRetentionPercent: null,
  warrantyRetentionReleaseOn: null,
  maturityDays: 30,
  paymentTerms: "30 dní",
  signedAt: "2026-01-15",
  effectiveFrom: null,
  effectiveTo: null,
  documentUrl: null,
  documentStoragePath: "projects/project-1/contracts/contract-1.pdf",
  documentFileName: "smlouva.pdf",
  amendments: [{
    id: "amendment-1",
    amendmentNo: 1,
    status: "active",
    signedAt: null,
    effectiveFrom: null,
    deltaPrice: 200_000,
    documentUrl: null,
    documentStoragePath: null,
    documentFileName: null,
  }],
};

const meta: ContractOverviewExportMeta = {
  organizationName: "REKO a.s.",
  exportedBy: "Martin Kalkus",
  exportedAt: new Date("2026-08-10T08:30:00.000Z"),
  appVersion: "1.9.0-beta.14",
  appLogoDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
};

describe("contractOverviewExport", () => {
  it("vytvoří branded přehled se stejnou strukturou jako export smluv ve stavbě", async () => {
    const workbook = await buildContractOverviewWorkbook(
      [overviewRow],
      ["warrantyEnd", "retentionShort", "paymentTerms"],
      meta,
    );
    const sheet = workbook.getWorksheet("Smluvní přehled");

    expect(sheet?.getCell("C1").value).toBe("Smluvní přehled");
    expect(sheet?.getCell("C1").alignment?.horizontal).toBe("center");
    expect(sheet?.getCell("C2").value).toContain("REKO a.s.");
    expect(sheet?.getCell("C3").value).toBe("Export provedl: Martin Kalkus");
    expect(sheet?.getCell("C4").value).toContain("Tender Flow 1.9.0-beta.14");
    expect(sheet?.getImages()).toHaveLength(1);
    expect(sheet?.getCell("A9").value).toBe("Typ řádku");
    expect(sheet?.getCell("A9").font.bold).toBe(true);
    expect(sheet?.getCell("A9").alignment?.wrapText).toBe(true);
    expect(sheet?.getCell("A10").value).toBe("Smlouva");
    expect(sheet?.getCell("G10").value).toBe(1_200_000);
    expect(sheet?.getCell("G10").numFmt).toContain("Kč");
    expect(sheet?.getCell("K10").value).toBeInstanceOf(Date);
    expect(sheet?.getCell("K10").numFmt).toBe("dd.mm.yyyy");
    expect(sheet?.getCell("L10").numFmt).toContain("%");
    expect(sheet?.getCell("A11").value).toBe("Dodatek");
    expect(sheet?.getCell("G11").value).toBeNull();
    expect(sheet?.getCell("G11").numFmt).toBeUndefined();
    expect(sheet?.getCell("K11").value).toBeNull();
    expect(sheet?.getCell("K11").numFmt).toBeUndefined();
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", xSplit: 3, ySplit: 9 });
    expect(sheet?.autoFilter).toEqual({ from: "A9", to: "M11" });
  });

  it("neutralizuje text začínající vzorcem i v branded exportu", async () => {
    const workbook = await buildContractOverviewWorkbook(
      [{ ...overviewRow, contractPartner: '=HYPERLINK("https://attacker.invalid")' }],
      [],
      { ...meta, appLogoDataUrl: null },
    );
    const cell = workbook.getWorksheet("Smluvní přehled")?.getCell("C10");

    expect(cell?.value).toBe("'=HYPERLINK(\"https://attacker.invalid\")");
    expect(cell?.formula).toBeUndefined();
  });

  it("použije relativní cestu loga pro desktopový Vite build", () => {
    expect(resolveContractOverviewLogoUrl("./")).toBe("./TF_ico.png");
    expect(resolveContractOverviewLogoUrl("/")).toBe("/TF_ico.png");
  });

  it("u víceměnového výběru nesčítá neslučitelné finanční hodnoty", async () => {
    const workbook = await buildContractOverviewWorkbook(
      [overviewRow, {
        ...overviewRow,
        contractId: "contract-2",
        currency: "EUR",
        currentTotal: 20_000,
        approvedDrawdown: 5_000,
        remainingAmount: 15_000,
      }],
      [],
      { ...meta, appLogoDataUrl: null },
    );
    const sheet = workbook.getWorksheet("Smluvní přehled");

    expect(sheet?.getCell("A7").value).toBe(2);
    expect(sheet?.getCell("D7").value).toBe("Více měn");
    expect(sheet?.getCell("G7").value).toBe("Více měn");
    expect(sheet?.getCell("J7").value).toBe("Více měn");
  });
});
