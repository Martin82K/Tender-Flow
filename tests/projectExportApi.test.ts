import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

const exportServiceMock = vi.hoisted(() => ({
  exportSupplierAnalysisToPDF: vi.fn(),
  exportToMarkdown: vi.fn(),
  exportToPDF: vi.fn(),
  exportToXLSX: vi.fn(),
}));

vi.mock("@/services/exportService", () => exportServiceMock);

import { projectExportApi } from "../features/projects/api/projectExportApi";

describe("projectExportApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje project exporty do legacy export service", () => {
    const category = { id: "cat-1", title: "Elektro" } as DemandCategory;
    const bids = [{ id: "bid-1", companyName: "Firma" }] as Bid[];
    const project = { id: "project-1", title: "Stavba" } as ProjectDetails;

    projectExportApi.exportToXLSX(category, bids, project);
    projectExportApi.exportToMarkdown(category, bids, project);
    projectExportApi.exportToPDF(category, bids, project);

    expect(exportServiceMock.exportToXLSX).toHaveBeenCalledWith(category, bids, project);
    expect(exportServiceMock.exportToMarkdown).toHaveBeenCalledWith(category, bids, project);
    expect(exportServiceMock.exportToPDF).toHaveBeenCalledWith(category, bids, project);
  });

  it("deleguje supplier analysis PDF včetně chart image payloadu", () => {
    const summary = {
      totalAwardedValue: 1,
      totalSodRealizationValue: 2,
      offerCount: 3,
      shortlistCount: 1,
      sodCount: 1,
      rejectedCount: 1,
      successRate: 33,
      avgDiffSodPercent: null,
      avgDiffPlanPercent: 4,
    };
    const offers = [];
    const chartImage = { dataUrl: "data:image/png;base64,abc", width: 100, height: 50 };

    projectExportApi.exportSupplierAnalysisToPDF("Dodavatel", summary, offers, "Tender Flow", chartImage);

    expect(exportServiceMock.exportSupplierAnalysisToPDF).toHaveBeenCalledWith(
      "Dodavatel",
      summary,
      offers,
      "Tender Flow",
      chartImage,
    );
  });
});
