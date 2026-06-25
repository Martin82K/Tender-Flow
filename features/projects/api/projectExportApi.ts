import {
  exportSupplierAnalysisToPDF as exportSupplierAnalysisToPDFLegacy,
  exportToMarkdown as exportToMarkdownLegacy,
  exportToPDF as exportToPDFLegacy,
  exportToXLSX as exportToXLSXLegacy,
} from "@infra/export/exportService";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";
import type { TenderSelectionExportMeta } from "@infra/export/exportService";

export const projectExportApi = {
  exportToXLSX(
    category: DemandCategory,
    bids: Bid[],
    project: ProjectDetails,
    meta?: TenderSelectionExportMeta,
  ): Promise<void> {
    return exportToXLSXLegacy(category, bids, project, meta);
  },

  exportToMarkdown(
    category: DemandCategory,
    bids: Bid[],
    project: ProjectDetails,
  ): void {
    exportToMarkdownLegacy(category, bids, project);
  },

  exportToPDF(
    category: DemandCategory,
    bids: Bid[],
    project: ProjectDetails,
    meta?: TenderSelectionExportMeta,
  ): Promise<void> {
    return exportToPDFLegacy(category, bids, project, meta);
  },

  exportSupplierAnalysisToPDF(
    ...args: Parameters<typeof exportSupplierAnalysisToPDFLegacy>
  ): void {
    exportSupplierAnalysisToPDFLegacy(...args);
  },
};
