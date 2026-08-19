import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => {
  const doc = {
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    addImage: vi.fn(),
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    save: vi.fn(),
  };
  return {
    doc,
    autoTable: vi.fn(),
    registerRobotoFont: vi.fn(),
    jsPDF: vi.fn(function JsPdfMock() { return doc; }),
  };
});

vi.mock("@/shared/pdf/pdfRuntime", () => ({
  loadPdfRuntime: vi.fn(async () => ({
    RobotoRegularBase64: "font",
    autoTable: pdfMocks.autoTable,
    jsPDF: pdfMocks.jsPDF,
  })),
  registerRobotoFont: pdfMocks.registerRobotoFont,
}));

import {
  buildTenderOverviewExportRows,
  buildTenderOverviewWorkbook,
  exportTenderOverviewToPdf,
  getTenderBidStatusLabel,
  sortTenderBidsByStatus,
} from "@features/projects/api/pipelineOverviewExportApi";
import type { Bid, DemandCategory } from "@/types";

const category: DemandCategory = {
  id: "category-1",
  title: "Betony",
  budget: "~1 000 000 Kč",
  sodBudget: 1_000_000,
  planBudget: 900_000,
  status: "closed",
  subcontractorCount: 3,
  description: "Dodávka betonových směsí",
  deadline: "2026-08-24",
  realizationStart: "2026-09-01",
  realizationEnd: "2026-10-30",
};

const bids: Bid[] = [
  {
    id: "bid-offer",
    subcontractorId: "supplier-1",
    companyName: "BETON ALFA s.r.o.",
    contactPerson: "Jan Novák",
    email: "jan@example.cz",
    price: "764055,00",
    status: "offer",
    notes: "Cena včetně dopravy",
  },
  {
    id: "bid-missing",
    subcontractorId: "supplier-2",
    companyName: "=NEBEZPEČNÝ VZOREC",
    contactPerson: "Petr Svoboda",
    status: "sent",
  },
  {
    id: "bid-rejected",
    subcontractorId: "supplier-3",
    companyName: "BETON BETA a.s.",
    contactPerson: "Eva Malá",
    status: "rejected",
  },
];

describe("pipelineOverviewExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfMocks.doc.getNumberOfPages.mockReturnValue(1);
    pdfMocks.doc.splitTextToSize.mockImplementation((text: string) => [text]);
  });

  it("odvozuje čitelné stavy z existujícího pipeline modelu", () => {
    expect(getTenderBidStatusLabel(bids[0])).toBe("Dodal cenu");
    expect(getTenderBidStatusLabel(bids[1])).toBe("Nedodal cenu");
    expect(getTenderBidStatusLabel(bids[2])).toBe("Zamítnut / odstoupil");
    expect(getTenderBidStatusLabel({ ...bids[0], status: "shortlist" })).toBe("Užší výběr");
    expect(getTenderBidStatusLabel({ ...bids[0], status: "sod", contracted: false })).toBe("Jednání o SOD");
    expect(getTenderBidStatusLabel({ ...bids[0], status: "sod", contracted: true })).toBe("Zasmluvněn");
  });

  it("nepovažuje nečíselný text za cenu, ale zachová skutečnou nulovou nabídku", () => {
    const invalidPriceBid = {
      ...bids[0],
      id: "invalid-price",
      companyName: "Nečíselná nabídka",
      price: "bude doplněno",
      status: "sent" as const,
    };
    const zeroPriceBid = {
      ...bids[0],
      id: "zero-price",
      companyName: "Nulová nabídka",
      price: "0 Kč",
      status: "sent" as const,
    };

    expect(getTenderBidStatusLabel(invalidPriceBid)).toBe("Nedodal cenu");
    expect(getTenderBidStatusLabel(zeroPriceBid)).toBe("Dodal cenu");

    const rows = buildTenderOverviewExportRows(
      [category],
      { [category.id]: [invalidPriceBid, zeroPriceBid] },
    );
    const invalidRow = rows.find((row) => row[2] === "Nečíselná nabídka");
    const zeroRow = rows.find((row) => row[2] === "Nulová nabídka");

    expect(invalidRow?.[1]).toBe("Nedodal cenu");
    expect(invalidRow?.[5]).toBeNull();
    expect(invalidRow?.[7]).toBe("Ne");
    expect(zeroRow?.[1]).toBe("Dodal cenu");
    expect(zeroRow?.[5]).toBe(0);
    expect(zeroRow?.[7]).toBe("Ano");
  });

  it("řadí dodavatele podle výsledného stavu a uvnitř stavu abecedně", () => {
    const sorted = sortTenderBidsByStatus([
      { ...bids[2], id: "rejected" },
      { ...bids[0], id: "offer-z", companyName: "Zeta" },
      { ...bids[1], id: "missing" },
      { ...bids[0], id: "offer-a", companyName: "Alfa" },
      { ...bids[0], id: "selected", companyName: "Selected", status: "shortlist" },
      { ...bids[0], id: "negotiating", companyName: "Negotiator", status: "sod", contracted: false },
      { ...bids[0], id: "contracted", companyName: "Winner", status: "sod", contracted: true },
    ]);

    expect(sorted.map((bid) => [getTenderBidStatusLabel(bid), bid.companyName])).toEqual([
      ["Zasmluvněn", "Winner"],
      ["Jednání o SOD", "Negotiator"],
      ["Užší výběr", "Selected"],
      ["Dodal cenu", "Alfa"],
      ["Dodal cenu", "Zeta"],
      ["Nedodal cenu", "=NEBEZPEČNÝ VZOREC"],
      ["Zamítnut / odstoupil", "BETON BETA a.s."],
    ]);
  });

  it("sestaví hierarchické řádky VŘ a jeho dodavatelů", () => {
    const rows = buildTenderOverviewExportRows([category], { [category.id]: bids });

    expect(rows[1]).toEqual(expect.arrayContaining(["Výběrové řízení", "Betony"]));
    expect(rows[2]).toEqual(expect.arrayContaining(["Dodavatel", "BETON ALFA s.r.o.", "Dodal cenu"]));
    expect(rows[3]).toEqual(expect.arrayContaining(["Dodavatel", "=NEBEZPEČNÝ VZOREC", "Nedodal cenu"]));
    expect(rows[4]).toEqual(expect.arrayContaining(["Dodavatel", "BETON BETA a.s.", "Zamítnut / odstoupil"]));
  });

  it("vytvoří stylizovaný XLSX s identitou aplikace, stavbou, typem, časem a uživatelem", async () => {
    const workbook = await buildTenderOverviewWorkbook(
      [category],
      { [category.id]: bids },
      {
        organizationName: "REKO a.s.",
        projectTitle: "26026 Oprava mostu m.35",
        projectStatus: "realization",
        exportedBy: "Martin Kalkus",
        exportedAt: new Date("2026-08-19T16:30:00.000Z"),
        appVersion: "1.9.12",
        appLogoDataUrl: null,
      },
    );

    const sheet = workbook.getWorksheet("Výběrová řízení");
    expect(sheet?.getCell("C1").value).toBe("Přehled výběrových řízení");
    expect(sheet?.getCell("C2").value).toContain("26026 Oprava mostu m.35 · Realizace");
    expect(sheet?.getCell("C3").value).toBe("Export provedl: Martin Kalkus");
    expect(sheet?.getCell("C4").value).toContain("Tender Flow 1.9.12");
    expect(sheet?.getCell("A9").value).toBe("Typ řádku");
    expect(sheet?.getCell("A10").value).toBe("Výběrové řízení");
    expect(sheet?.getCell("A11").value).toBe("Dodavatel");
    expect(sheet?.getCell("C12").value).toBe("'=NEBEZPEČNÝ VZOREC");
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 9 });
  });

  it("vytvoří PDF se stejnou hierarchií a úplnými exportními metadaty", async () => {
    await exportTenderOverviewToPdf(
      [category],
      { [category.id]: bids },
      {
        organizationName: "REKO a.s.",
        projectTitle: "26026 Oprava mostu m.35",
        projectStatus: "tender",
        exportedBy: "Martin Kalkus",
        exportedAt: new Date("2026-08-19T16:30:00.000Z"),
        appVersion: "1.9.12",
        appLogoDataUrl: null,
      },
    );

    expect(pdfMocks.doc.text).toHaveBeenCalledWith(
      "REKO a.s. · 26026 Oprava mostu m.35 · Soutěž",
      14,
      25,
    );
    expect(pdfMocks.doc.text).toHaveBeenCalledWith("Export provedl: Martin Kalkus", 14, 31);
    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      pdfMocks.doc,
      expect.objectContaining({
        body: expect.arrayContaining([
          expect.arrayContaining(["Výběrové řízení", "Betony"]),
          expect.arrayContaining(["Dodavatel", "BETON ALFA s.r.o.", "Dodal cenu"]),
          expect.arrayContaining(["Dodavatel", "=NEBEZPEČNÝ VZOREC", "Nedodal cenu"]),
        ]),
      }),
    );
    expect(pdfMocks.doc.save).toHaveBeenCalledWith(
      expect.stringMatching(/^prehled_vr_26026_oprava_mostu_m_35_\d{4}-\d{2}-\d{2}\.pdf$/),
    );

    const tableOptions = pdfMocks.autoTable.mock.calls.at(-1)?.[1] as {
      columnStyles: Record<number, { cellWidth?: number }>;
      margin: { left: number; right: number };
    };
    const fixedWidth = Object.values(tableOptions.columnStyles).reduce(
      (sum, style) => sum + (style.cellWidth ?? 0),
      0,
    );
    const printableWidth = pdfMocks.doc.internal.pageSize.getWidth()
      - tableOptions.margin.left
      - tableOptions.margin.right;
    expect(fixedWidth).toBeLessThanOrEqual(printableWidth);
  });

  it("zalomí dlouhá metadata a posune auditní řádek i tabulku pod ně", async () => {
    pdfMocks.doc.splitTextToSize.mockReturnValue([
      "Velmi dlouhá organizace · Velmi dlouhá stavba",
      "s doplňujícím názvem a číslem · Realizace",
      "poslední řádek metadat",
    ]);

    await exportTenderOverviewToPdf(
      [category],
      { [category.id]: bids },
      {
        organizationName: "Velmi dlouhá organizace",
        projectTitle: "Velmi dlouhá stavba s doplňujícím názvem a číslem",
        projectStatus: "realization",
        exportedBy: "Martin Kalkus",
        exportedAt: new Date("2026-08-19T16:30:00.000Z"),
        appVersion: "1.9.12",
        appLogoDataUrl: null,
      },
    );

    expect(pdfMocks.doc.splitTextToSize).toHaveBeenCalledWith(
      "Velmi dlouhá organizace · Velmi dlouhá stavba s doplňujícím názvem a číslem · Realizace",
      269,
    );
    expect(pdfMocks.doc.text).toHaveBeenCalledWith(
      [
        "Velmi dlouhá organizace · Velmi dlouhá stavba",
        "s doplňujícím názvem a číslem · Realizace",
        "poslední řádek metadat",
      ],
      14,
      25,
    );
    expect(pdfMocks.doc.text).toHaveBeenCalledWith("Export provedl: Martin Kalkus", 14, 39);
    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      pdfMocks.doc,
      expect.objectContaining({ startY: 46 }),
    );
  });
});
