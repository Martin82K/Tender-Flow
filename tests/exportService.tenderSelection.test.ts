import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";
import type { UserOptions } from "jspdf-autotable";

const saveMock = vi.hoisted(() => vi.fn());
const addImageMock = vi.hoisted(() => vi.fn());
const textMock = vi.hoisted(() => vi.fn());
const autoTableMock = vi.hoisted(() => vi.fn((doc: { lastAutoTable?: { finalY: number } }, _options?: UserOptions) => {
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
    this.splitTextToSize = vi.fn((value: string) => [value]);
    this.getNumberOfPages = vi.fn(() => 1);
    this.setPage = vi.fn();
    this.save = saveMock;
    this.internal = {
      pageSize: {
        getWidth: () => 297,
        getHeight: () => 210,
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

vi.mock("../fonts/roboto-regular", () => ({
  RobotoRegularBase64: "AA==",
}));

import { exportToPDF, exportToXLSX } from "../services/exportService";

const pngBytes = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l77J2QAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

const category: DemandCategory = {
  id: "cat-1",
  title: "Obklady a dlažby",
  budget: "",
  sodBudget: 2550849,
  planBudget: 2070964,
  status: "sod",
  subcontractorCount: 3,
  description: "Dodávka materiálů včetně dopravy.",
  deadline: "2026-12-08",
};

const project: ProjectDetails = {
  id: "project-1",
  title: "REKO Bazén Aš",
  location: "Aš",
  finishDate: "",
  siteManager: "",
  categories: [],
};

const bids: Bid[] = [
  {
    id: "bid-1",
    subcontractorId: "sub-1",
    companyName: "MK Rako",
    contactPerson: "Marcel Koutecký",
    email: "marcel@example.cz",
    phone: "736501761",
    price: "189 012 Kč",
    status: "sod",
    notes: "Budou účtovány dopravy.",
  },
  {
    id: "bid-2",
    subcontractorId: "sub-2",
    companyName: '=HYPERLINK("https://attacker")',
    contactPerson: "@malicious",
    email: "tomas@example.cz",
    phone: "724141540",
    price: "87 052 Kč",
    status: "sod",
    tags: ["interní"],
    notes: "-2 dny splatnost",
  },
];

const fetchMock = vi.hoisted(() => vi.fn());

const mockLogoFetch = () => {
  fetchMock.mockImplementation(async () =>
    new Response(new Blob([pngBytes], { type: "image/png" }), {
      status: 200,
      headers: { "content-type": "image/png" },
    }),
  );
  vi.stubGlobal(
    "fetch",
    fetchMock,
  );
};

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe("exportService tender selection exports", () => {
  let downloadedBlob: Blob | null;

  beforeEach(() => {
    downloadedBlob = null;
    saveMock.mockReset();
    addImageMock.mockReset();
    textMock.mockReset();
    autoTableMock.mockReset();
    fetchMock.mockReset();
    mockLogoFetch();
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      downloadedBlob = blob as Blob;
      return "blob:tender-selection";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("vytvoří stylizovaný XLSX bez statistik, bilance a tagů s vítězem celkem", async () => {
    await exportToXLSX(category, bids, project, {
      organizationName: "Tenant Demo",
      organizationLogoUrl: "https://tenant.example/logo.png",
    });

    expect(downloadedBlob).toBeTruthy();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await readBlobAsArrayBuffer(downloadedBlob!));
    const sheet = workbook.getWorksheet("Poptávka");
    expect(sheet).toBeTruthy();

    const values: string[] = [];
    sheet!.eachRow((row) => {
      row.eachCell((cell) => {
        values.push(String(cell.value ?? ""));
      });
    });

    expect(values).toContain("ZÁPIS O VÝBĚRU");
    expect(values).toContain("Vítěz celkem:");
    expect(values.some((value) => value.replace(/\s/g, " ").includes("276 064,00"))).toBe(true);
    expect(values).toContain("Exportováno:");
    expect(values.some((value) => value.includes("Exportováno z Tender Flow"))).toBe(true);
    expect(values).not.toContain("Tagy");
    expect(values).not.toContain("STATISTIKY");
    expect(values).not.toContain("BILANCE VÍTĚZE (Jednání o SOD)");
    expect(values).toContain("'=HYPERLINK(\"https://attacker\")");
    expect(values).toContain("'@malicious");
    expect(values).toContain("'-2 dny splatnost");
  });

  it("vytvoří PDF přes celou šíři s logy a poznámkou dodavatele", async () => {
    await exportToPDF(category, bids, project, {
      organizationLogoUrl: "https://tenant.example/logo.png",
    });

    expect(fetchMock).toHaveBeenCalledWith("/TF_ico.png");
    expect(fetchMock).toHaveBeenCalledWith("https://tenant.example/logo.png");
    expect(autoTableMock).toHaveBeenCalledTimes(1);
    const tableOptions = autoTableMock.mock.calls[0]?.[1];

    expect(tableOptions).toBeDefined();
    if (!tableOptions) throw new Error("Chybí options pro jspdf-autotable");
    expect(tableOptions.tableWidth).toBe(277);
    expect(tableOptions.head[0]).toContain("Poznámka");
    expect(tableOptions.body[0]).toContain("Budou účtovány dopravy.");
    expect(textMock).toHaveBeenCalledWith(expect.stringContaining("Vítěz celkem"), 287, 40, {
      align: "right",
    });
    expect(saveMock).toHaveBeenCalledWith(expect.stringContaining("poptavka_Obklady"));
  });
});
