import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ load: vi.fn(), writeFile: vi.fn(), aoaToSheet: vi.fn(() => ({})) }));
vi.mock("xlsx", () => {
  runtime.load();
  return {
    utils: { book_new: () => ({}), aoa_to_sheet: runtime.aoaToSheet, book_append_sheet: vi.fn(), sheet_to_csv: () => "csv" },
    writeFile: runtime.writeFile,
  };
});

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe("lazy Excel exports", () => {
  it("does not load the Excel runtime until the tender template is requested", async () => {
    const api = await import("@/features/projects/api/tenderPlanExportApi");
    expect(runtime.load).not.toHaveBeenCalled();
    await api.downloadTenderImportTemplate();
    expect(runtime.load).toHaveBeenCalledOnce();
    expect(runtime.writeFile).toHaveBeenCalledWith({}, "sablona_import_poptavky.xlsx");
  });

  it("preserves schedule export after loading the runtime on demand", async () => {
    const api = await import("@/features/projects/api/projectScheduleExportApi");
    expect(runtime.load).not.toHaveBeenCalled();
    await api.exportScheduleToXLSX([], "Projekt", new Date("2026-09-01"), new Date("2026-09-30"), "tender");
    expect(runtime.writeFile).toHaveBeenCalledOnce();
    expect(runtime.aoaToSheet).toHaveBeenCalledWith(expect.arrayContaining([["Projekt:", "Projekt"]]));
  });
});
