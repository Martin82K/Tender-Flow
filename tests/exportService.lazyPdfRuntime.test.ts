import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeLoads = vi.hoisted(() => ({
  autoTable: vi.fn(),
  font: vi.fn(),
  jsPdf: vi.fn(),
  marked: vi.fn(),
}));

const saveMock = vi.hoisted(() => vi.fn());
const addFileToVfsMock = vi.hoisted(() => vi.fn());
const addFontMock = vi.hoisted(() => vi.fn());

vi.mock("jspdf", () => {
  runtimeLoads.jsPdf();

  return {
    default: vi.fn().mockImplementation(function MockJsPdf(this: any) {
      this.addFileToVFS = addFileToVfsMock;
      this.addFont = addFontMock;
      this.setFont = vi.fn();
      this.setFontSize = vi.fn();
      this.setTextColor = vi.fn();
      this.splitTextToSize = vi.fn((value: string) => [value]);
      this.text = vi.fn();
      this.getNumberOfPages = vi.fn(() => 1);
      this.setPage = vi.fn();
      this.save = saveMock;
      this.internal = {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      };
    }),
  };
});

vi.mock("jspdf-autotable", () => {
  runtimeLoads.autoTable();
  return { default: vi.fn() };
});

vi.mock("marked", () => {
  runtimeLoads.marked();
  return { marked: { lexer: vi.fn(() => []) } };
});

vi.mock("../fonts/roboto-regular", () => {
  runtimeLoads.font();
  return { RobotoRegularBase64: "AA==" };
});

vi.mock("@features/organization/api", () => ({ organizationService: {} }));
vi.mock("@features/projects/contracts/api", () => ({
  contractQueriesApi: {},
}));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: {} }));

describe("exportService lazy PDF runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    runtimeLoads.autoTable.mockClear();
    runtimeLoads.font.mockClear();
    runtimeLoads.jsPdf.mockClear();
    runtimeLoads.marked.mockClear();
    saveMock.mockClear();
    addFileToVfsMock.mockClear();
    addFontMock.mockClear();
  });

  it("načte PDF runtime až při prvním PDF exportu", async () => {
    const [exportService] = await Promise.all([
      import("../services/exportService"),
      import("../features/projects/api/projectScheduleExportApi"),
      import("../features/projects/api/generateContractProtocol"),
    ]);

    expect(runtimeLoads.autoTable).not.toHaveBeenCalled();
    expect(runtimeLoads.font).not.toHaveBeenCalled();
    expect(runtimeLoads.jsPdf).not.toHaveBeenCalled();
    expect(runtimeLoads.marked).not.toHaveBeenCalled();

    await exportService.exportMarkdownToPdf(
      "smlouva_test",
      "# Nadpis",
      "Náhled smlouvy",
    );

    expect(runtimeLoads.autoTable).toHaveBeenCalledTimes(1);
    expect(runtimeLoads.font).toHaveBeenCalledTimes(1);
    expect(runtimeLoads.jsPdf).toHaveBeenCalledTimes(1);
    expect(runtimeLoads.marked).toHaveBeenCalledTimes(1);
    expect(addFileToVfsMock).toHaveBeenCalledWith("Roboto-Regular.ttf", "AA==");
    expect(addFontMock).toHaveBeenCalledWith(
      "Roboto-Regular.ttf",
      "Roboto",
      "bold",
      "Identity-H",
    );
    expect(saveMock).toHaveBeenCalledWith("smlouva_test.pdf");
  });
});
