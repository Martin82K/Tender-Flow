import type { HeaderMapping } from "@/services/excelMergerTypes";

export interface ExcelMergeOptions {
  sheetsToInclude?: string[];
  headerMapping?: HeaderMapping;
  applyFilter?: boolean;
  freezeHeader?: boolean;
  showGridlines?: boolean;
  onProgress?: (message: string) => void;
  onProgressUpdate?: (progress: number) => void;
}

export interface ExcelToolsProvider {
  checkHealth: () => Promise<boolean>;
  analyzeFile: (file: File) => Promise<string[]>;
  mergeExcel: (file: File, options?: ExcelMergeOptions) => Promise<Blob>;
  unlockExcel: (file: File) => Promise<Blob>;
}
