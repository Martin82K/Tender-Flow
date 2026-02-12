import { isDesktop } from "@/services/platformAdapter";
import { httpExcelToolsProvider } from "@infra/excel-tools/providers/httpExcelToolsProvider";
import { nativeExcelToolsProvider } from "@infra/excel-tools/providers/nativeExcelToolsProvider";
import type { ExcelToolsProvider } from "@infra/excel-tools/types";

export type ExcelToolsProviderMode = "native" | "http" | "hybrid";

export interface ResolvedExcelToolsProviders {
  mergeProvider: ExcelToolsProvider;
  unlockProvider: ExcelToolsProvider;
  mode: ExcelToolsProviderMode;
}

const resolveProviderMode = (): ExcelToolsProviderMode => {
  const rawMode = (import.meta.env.VITE_EXCEL_TOOLS_PROVIDER || "hybrid").toLowerCase();

  if (rawMode === "native" || rawMode === "http" || rawMode === "hybrid") {
    return rawMode;
  }

  return "hybrid";
};

export const resolveExcelToolsProviders = (): ResolvedExcelToolsProviders => {
  const mode = resolveProviderMode();

  if (isDesktop) {
    return {
      mergeProvider: nativeExcelToolsProvider,
      unlockProvider: nativeExcelToolsProvider,
      mode: "native",
    };
  }

  if (mode === "native") {
    return {
      mergeProvider: nativeExcelToolsProvider,
      unlockProvider: nativeExcelToolsProvider,
      mode,
    };
  }

  if (mode === "http") {
    return {
      mergeProvider: httpExcelToolsProvider,
      unlockProvider: httpExcelToolsProvider,
      mode,
    };
  }

  return {
    mergeProvider: nativeExcelToolsProvider,
    unlockProvider: httpExcelToolsProvider,
    mode: "hybrid",
  };
};
