import { ExcelService } from "@/services/excelMergerService";
import { unlockExcelZip } from "@/utils/excelUnlockZip";
import type { ExcelMergeOptions, ExcelToolsProvider } from "@infra/excel-tools/types";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const resolveSheetSelection = async (file: File, options?: ExcelMergeOptions): Promise<string[]> => {
  if (options?.sheetsToInclude?.length) {
    return options.sheetsToInclude;
  }
  return ExcelService.analyzeFile(file);
};

export const nativeExcelToolsProvider: ExcelToolsProvider = {
  async checkHealth() {
    return true;
  },

  async analyzeFile(file: File) {
    return ExcelService.analyzeFile(file);
  },

  async mergeExcel(file: File, options?: ExcelMergeOptions) {
    const sheetsToInclude = await resolveSheetSelection(file, options);
    return ExcelService.mergeSheets(
      file,
      sheetsToInclude,
      options?.onProgress,
      options?.onProgressUpdate,
      options?.headerMapping,
      options?.applyFilter ?? false,
      options?.freezeHeader ?? false,
      options?.showGridlines ?? true,
    );
  },

  async unlockExcel(file: File) {
    const buffer = await file.arrayBuffer();
    const output = await unlockExcelZip(buffer);
    return new Blob([output], { type: XLSX_MIME });
  },
};
