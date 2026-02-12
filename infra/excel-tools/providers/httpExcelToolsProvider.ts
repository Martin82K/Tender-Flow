import { ExcelService } from "@/services/excelMergerService";
import type { ExcelMergeOptions, ExcelToolsProvider } from "@infra/excel-tools/types";

const DEFAULT_EXCEL_TOOLS_URL = "http://localhost:5001";

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const createTimeoutSignal = (timeoutMs: number): AbortSignal => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
};

class HttpExcelToolsProvider implements ExcelToolsProvider {
  constructor(private readonly baseUrl: string) {}

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: createTimeoutSignal(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async analyzeFile(file: File): Promise<string[]> {
    return ExcelService.analyzeFile(file);
  }

  async mergeExcel(file: File, options?: ExcelMergeOptions): Promise<Blob> {
    const sheetsToInclude = options?.sheetsToInclude?.length
      ? options.sheetsToInclude
      : await this.analyzeFile(file);

    return ExcelService.mergeSheetsViaApi(
      file,
      sheetsToInclude,
      options?.onProgress,
      options?.onProgressUpdate,
    );
  }

  async unlockExcel(file: File): Promise<Blob> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/unlock`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await readErrorText(response);
      throw new Error(message);
    }

    return response.blob();
  }
}

export const httpExcelToolsProvider = new HttpExcelToolsProvider(
  import.meta.env.VITE_EXCEL_TOOLS_URL || DEFAULT_EXCEL_TOOLS_URL,
);
