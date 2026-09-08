import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import { buildProjectOverviewWorkbook, exportProjectOverviewToXlsx } from "@features/projects/api/projectOverviewExportApi";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

const category = (id: string, title: string, status: DemandCategory["status"] = "closed"): DemandCategory => ({
  id, title, status, budget: "", description: "", sodBudget: 1000, planBudget: 800, subcontractorCount: 3,
});
const winner = (id: string, price: string, contracted = true): Bid => ({
  id, price, contracted, companyName: `Dodavatel ${id}`, contactPerson: "", status: "sod",
});
const project: ProjectDetails = {
  id: "project-1", title: "REKO Bazén Aš", investor: "Město Aš", location: "Aš",
  address: "Hlavní 1", finishDate: "09/2026", siteManager: "Jan Novák",
  categories: [category("z", "Zemní práce", "open"), category("b", "Betony"), category("a", "Areál")],
  bids: { b: [winner("b1", "600 Kč"), winner("b2", "300 Kč", false)], a: [winner("a1", "0 Kč")] },
  plannedCost: 2500, internalAmendments: [{ id: "ia", label: "Dodatek", price: 100 }],
  investorFinancials: { sodPrice: 4000, amendments: [{ id: "a", label: "Dodatek", price: 200 }], invoices: [
    { id: "i", invoiceNumber: "1", amount: 500, currency: "CZK", status: "paid", issueDate: "2026-01-01", dueDate: "2026-01-31" },
  ] },
  contract: { maturity: 30, warranty: 24, retention: "5 %", siteFacilities: 2, insurance: 1 },
};
const options = {
  demandFilter: "all" as const, searchQuery: "",
  visibleColumns: { sod: true, plan: true, sod_vr: true, pn_vr: true, nabidky: true, smlouvy: true },
  exportedAt: new Date("2026-09-08T10:30:00Z"),
};
const values = (sheet: ExcelJS.Worksheet) => {
  const rows: ExcelJS.CellValue[][] = [];
  sheet.eachRow(row => rows.push((row.values as ExcelJS.CellValue[]).slice(1)));
  return rows;
};

describe("project overview Excel export", () => {
  it("serializes a real workbook with logo, source, Prague export time and the complete financial summary", async () => {
    const workbook = await buildProjectOverviewWorkbook(project, options);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const summary = reopened.getWorksheet("Přehled stavby")!;
    expect(summary.getImages()).toHaveLength(1);
    expect(summary.getCell("A2").value).toBe("Stavba: REKO Bazén Aš");
    expect(summary.getCell("A3").value).toBe("Zdroj: Tender Flow → REKO Bazén Aš → Přehled");
    expect(summary.getCell("A4").value).toContain("12:30:00");
    expect(summary.getCell("A4").value).toContain("Europe/Prague");
    expect(workbook.created).toEqual(options.exportedAt);
    const summaryRows = values(summary);
    for (const pair of [["Celkem investor", 4200], ["Fakturováno", 500], ["Zaplaceno", 500], ["Plán včetně dodatků", 2600], ["Zasmluvněno", 900], ["Rezerva", 1700], ["Splatnost", 30]]) {
      expect(summaryRows.some(row => row.some((value, index) => value === pair[0] && row[index + 1] === pair[1]))).toBe(true);
    }
    expect(reopened.getWorksheet("Poptávky")?.pageSetup).toMatchObject({ orientation: "landscape", fitToWidth: 1 });
  });

  it("matches visible columns, Czech sorting, multiple winners, zero bids and missing winners", async () => {
    const sheet = (await buildProjectOverviewWorkbook(project, options)).getWorksheet("Poptávky")!;
    expect(sheet.getRow(8).values).toEqual([undefined, "Stav", "Poptávka", "SOD", "Plán", "Cena VŘ", "SOD - VŘ", "Plán - VŘ", "Nabídky", "Smlouvy", "Dodavatel"]);
    expect(sheet.getRow(9).getCell(2).value).toBe("Areál");
    expect(sheet.getRow(9).getCell(5).value).toBe(0);
    expect(sheet.getRow(10).getCell(5).value).toBe(900);
    expect(sheet.getRow(10).getCell(7).value).toBe(-100);
    expect(sheet.getRow(10).getCell(8).value).toBe("2 / 3");
    expect(sheet.getRow(10).getCell(9).value).toBe("1 / 2");
    expect(sheet.getRow(10).getCell(10).value).toBe("Dodavatel b1, Dodavatel b2");
    expect(sheet.getRow(11).getCell(5).value).toBeNull();
    expect(sheet.getRow(11).getCell(7).value).toBeNull();
    expect(sheet.getRow(10).getCell(5).numFmt).toContain("Kč");
  });

  it("exports only matching rows and labels filtered and whole-project totals separately", async () => {
    const sheet = (await buildProjectOverviewWorkbook(project, {
      ...options, demandFilter: "sod", searchQuery: "Bet",
      visibleColumns: { ...options.visibleColumns, sod: false, sod_vr: false },
    })).getWorksheet("Poptávky")!;
    expect(sheet.getCell("A5").value).toContain("Zasmluvněné");
    expect(sheet.getCell("A5").value).toContain("Bet");
    expect(sheet.getCell("B9").value).toBe("Betony");
    expect(sheet.getCell("C9").value).toBe(800);
    expect(sheet.getCell("B10").value).toBe("Součet exportovaných řádků");
    expect(sheet.getCell("C10").value).toBe(800);
    expect(sheet.getCell("B11").value).toBe("Celková bilance stavby");
    expect(sheet.getCell("C11").value).toBe(2400);
    expect(sheet.getRow(8).values).not.toContain("SOD");
  });

  it.each([
    options.visibleColumns,
    { ...options.visibleColumns, sod: false, sod_vr: false, nabidky: false, smlouvy: false },
  ])("formats the whole tender row including blank prices after saving and reopening XLSX (%j)", async (visibleColumns) => {
    const workbook = await buildProjectOverviewWorkbook({
      ...project, categories: [...project.categories, category("zz", "Žulové obklady", "open")],
    }, { ...options, visibleColumns });
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Poptávky")!;
    const lastColumn = sheet.getRow(8).cellCount;
    for (const rowNumber of [11, 12]) {
      const row = sheet.getRow(rowNumber);
      const reference = row.getCell(2);
      for (let column = 1; column <= lastColumn; column += 1) {
        const cell = row.getCell(column);
        expect(cell.fill, cell.address).toEqual(reference.fill);
        expect(cell.font, cell.address).toEqual(reference.font);
        expect(cell.alignment, cell.address).toEqual(reference.alignment);
      }
      const priceColumn = (sheet.getRow(8).values as ExcelJS.CellValue[]).indexOf("Cena VŘ");
      expect(row.getCell(priceColumn).value).toBeNull();
      expect(row.getCell(priceColumn).numFmt).toContain("Kč");
    }
    expect(sheet.getCell("B11").fill).toMatchObject({ type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } });
  });

  it.each(["", "Bet", "nenalezeno"])("formats totals across the full width, including leading and trailing empty cells (search: %s)", async (searchQuery) => {
    const workbook = await buildProjectOverviewWorkbook(project, { ...options, searchQuery });
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Poptávky")!;
    const lastColumn = sheet.getRow(8).cellCount;
    const totals: ExcelJS.Row[] = [];
    sheet.eachRow(row => {
      if (["Součet exportovaných řádků", "Celková bilance stavby"].includes(String(row.getCell(2).value))) totals.push(row);
    });
    expect(totals).toHaveLength(searchQuery ? 2 : 1);
    for (const row of totals) {
      for (let column = 1; column <= lastColumn; column += 1) {
        const cell = row.getCell(column);
        expect(cell.border?.top, cell.address).toMatchObject({ style: "thin", color: { argb: "FF94A3B8" } });
        expect(cell.fill, cell.address).toMatchObject({ type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } });
        expect(cell.font?.bold, cell.address).toBe(true);
        expect(cell.alignment, cell.address).toMatchObject({ vertical: "middle", wrapText: true });
      }
      expect(row.getCell(1).value).toBeNull();
      expect(row.getCell(lastColumn).value).toBeNull();
    }
  });

  it("preserves user text as strings, never executable formulas or external links", async () => {
    const malicious = "\t=HYPERLINK(\"https://evil.invalid\",\"x\")";
    const workbook = await buildProjectOverviewWorkbook({
      ...project, title: malicious, investor: malicious,
      categories: [category("b", malicious)],
      bids: { b: [{ ...winner("b", "-100"), companyName: malicious }] },
    }, options);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    reopened.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
      expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
      expect(cell.type).not.toBe(ExcelJS.ValueType.Hyperlink);
    })));
    expect(reopened.getWorksheet("Poptávky")?.getCell("B9").value).toBe(`'${malicious}`);
    expect(reopened.getWorksheet("Poptávky")?.getCell("E9").value).toBe(-100);
  });

  it("supports an empty project and an empty search without inventing tender rows", async () => {
    for (const [input, searchQuery] of [[{ ...project, categories: [] }, ""], [project, "nenalezeno"]] as const) {
      const workbook = await buildProjectOverviewWorkbook(input, { ...options, searchQuery });
      const reopened = new ExcelJS.Workbook();
      await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
      const sheet = reopened.getWorksheet("Poptávky")!;
      expect(sheet.getCell("A6").value).toContain("0");
      expect(sheet.getCell("B9").value).toBe("Součet exportovaných řádků");
      expect(sheet.getCell("C9").value).toBe(0);
    }
  });

  it("includes every matching tender beyond the first ten shown on screen", async () => {
    const categories = Array.from({ length: 25 }, (_, i) => category(`c${i}`, `Práce ${String(i).padStart(2, "0")}`));
    const sheet = (await buildProjectOverviewWorkbook({ ...project, categories }, options)).getWorksheet("Poptávky")!;
    expect(sheet.getCell("B33").value).toBe("Práce 24");
    expect(sheet.getCell("C34").value).toBe(25000);
    expect(sheet.getCell("A6").value).toContain("25 z 25");
  });

  it("downloads an XLSX with a safe filename and releases the temporary link and object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:overview");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    let filename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
      expect(this.isConnected).toBe(true);
      vi.useFakeTimers();
    });
    try {
      await exportProjectOverviewToXlsx({ ...project, title: "../../Bazén : Aš" }, options);
      expect(filename).toMatch(/^prehled_Bazen_As_2026-09-08T10-30-00-000Z\.xlsx$/);
      expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
      expect(document.querySelector('a[href="blob:overview"]')).toBeNull();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runOnlyPendingTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:overview");
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
