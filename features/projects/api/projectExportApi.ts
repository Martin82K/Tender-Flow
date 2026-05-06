import {
  exportSupplierAnalysisToPDF as exportSupplierAnalysisToPDFLegacy,
  exportToMarkdown as exportToMarkdownLegacy,
  exportToPDF as exportToPDFLegacy,
  exportToXLSX as exportToXLSXLegacy,
} from "@infra/export/exportService";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

export const projectExportApi = {
  exportToXLSX(
    category: DemandCategory,
    bids: Bid[],
    project: ProjectDetails,
  ): void {
    exportToXLSXLegacy(category, bids, project);
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
  ): void {
    exportToPDFLegacy(category, bids, project);
  },

  exportSupplierAnalysisToPDF(
    ...args: Parameters<typeof exportSupplierAnalysisToPDFLegacy>
  ): void {
    exportSupplierAnalysisToPDFLegacy(...args);
  },
};
