import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.hoisted(() => vi.fn());
const textMock = vi.hoisted(() => vi.fn());
const addImageMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const autoTableMock = vi.hoisted(() => vi.fn((doc: any) => {
  doc.lastAutoTable = { finalY: 80 };
}));

const jsPdfCtor = vi.hoisted(() =>
  vi.fn().mockImplementation(function MockJsPDF(this: any) {
    this.addFileToVFS = vi.fn();
    this.addFont = vi.fn();
    this.setFont = vi.fn();
    this.setFontSize = vi.fn();
    this.setTextColor = vi.fn();
    this.addImage = addImageMock;
    this.text = textMock;
    this.getNumberOfPages = vi.fn(() => 1);
    this.setPage = vi.fn();
    this.save = saveMock;
    this.internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };
    this.lastAutoTable = { finalY: 80 };
  }),
);

vi.mock("jspdf", () => ({
  default: jsPdfCtor,
}));

vi.mock("jspdf-autotable", () => ({
  default: autoTableMock,
}));

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof import("xlsx")>("xlsx");
  return {
    ...actual,
    writeFile: writeFileMock,
  };
});

vi.mock("../fonts/roboto-regular", () => ({
  RobotoRegularBase64: "AA==",
}));

import {
  exportContractSummariesToPdf,
  exportContractSummariesToXlsx,
} from "../services/exportService";

const contracts = [
  {
    id: "contract-1",
    projectId: "project-1",
    title: "VZT",
    contractNumber: "SOD-001",
    vendorName: "KLIMA - ELEKTRON s.r.o.",
    status: "active" as const,
    currency: "CZK",
    basePrice: 100000,
    currentTotal: 120000,
    approvedSum: 30000,
    remaining: 90000,
    retentionPercent: 5,
    siteSetupPercent: 2,
    warrantyMonths: 24,
    paymentTerms: "21 dní",
  },
];

describe("exportService contract summaries", () => {
  beforeEach(() => {
    saveMock.mockReset();
    textMock.mockReset();
    addImageMock.mockReset();
    autoTableMock.mockReset();
    writeFileMock.mockReset();
  });

  it("vytvoří XLSX s hlavičkou organizace a patičkou Tender Flow", async () => {
    await exportContractSummariesToXlsx(contracts, {
      organizationName: "Tender Flow Demo",
      projectName: "Projekt A",
    });

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const workbook = writeFileMock.mock.calls[0][0] as XLSX.WorkBook;
    const sheet = workbook.Sheets["Smlouvy"];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      blankrows: false,
    });

    expect(rows[0]?.[0]).toBe("Tender Flow Demo");
    expect(rows[3]?.[0]).toBe("Číslo smlouvy");
    expect(rows.at(-1)?.[0]).toBe("Exportováno z Tender Flow");
  });



  it("sanitizuje nebezpečné prefixy v textových buňkách XLSX", async () => {
    await exportContractSummariesToXlsx(
      [
        {
          ...contracts[0],
          contractNumber: '=HYPERLINK("http://attacker")',
          vendorName: '@malicious',
          paymentTerms: '-2 dny',
        },
      ],
      {
        organizationName: "Tender Flow Demo",
        projectName: "Projekt A",
      },
    );

    const workbook = writeFileMock.mock.calls[0][0] as XLSX.WorkBook;
    const sheet = workbook.Sheets["Smlouvy"];

    expect(sheet["A6"]?.v).toBe("'=HYPERLINK(\"http://attacker\")");
    expect(sheet["B6"]?.v).toBe("'@malicious");
    expect(sheet["G6"]?.v).toBe("'-2 dny");
  });

  it("vytvoří PDF s hlavičkou projektu a patičkou Tender Flow", async () => {
    await exportContractSummariesToPdf(contracts, {
      organizationName: "Tender Flow Demo",
      projectName: "Projekt A",
    });

    expect(autoTableMock).toHaveBeenCalledTimes(1);
    expect(textMock).toHaveBeenCalledWith("Tender Flow Demo", 14, 18);
    expect(textMock).toHaveBeenCalledWith(
      expect.stringContaining("Exportováno z Tender Flow"),
      105,
      287,
      { align: "center" },
    );
    expect(saveMock).toHaveBeenCalledWith(
      expect.stringContaining("smlouvy_prehled_projekt_a_"),
    );
  });
});
