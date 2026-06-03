import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

const exportServiceMock = vi.hoisted(() => ({
  exportSupplierAnalysisToPDF: vi.fn(),
  exportToMarkdown: vi.fn(),
  exportToPDF: vi.fn(),
  exportToXLSX: vi.fn(),
}));

vi.mock("@infra/export/exportService", () => exportServiceMock);

import { projectExportApi } from "../features/projects/api/projectExportApi";

describe("projectExportApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje project exporty do legacy export service", async () => {
    const category = { id: "cat-1", title: "Elektro" } as DemandCategory;
    const bids = [{ id: "bid-1", companyName: "Firma" }] as Bid[];
    const project = { id: "project-1", title: "Stavba" } as ProjectDetails;
    const meta = { organizationName: "Tenant Demo" };

    await projectExportApi.exportToXLSX(category, bids, project, meta);
    projectExportApi.exportToMarkdown(category, bids, project);
    await projectExportApi.exportToPDF(category, bids, project, meta);

    expect(exportServiceMock.exportToXLSX).toHaveBeenCalledWith(category, bids, project, meta);
    expect(exportServiceMock.exportToMarkdown).toHaveBeenCalledWith(category, bids, project);
    expect(exportServiceMock.exportToPDF).toHaveBeenCalledWith(category, bids, project, meta);
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
