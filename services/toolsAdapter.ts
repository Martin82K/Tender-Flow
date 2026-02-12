/**
 * Tools Adapter
 *
 * Unified service for Excel tools that switches providers based on runtime:
 * - Desktop: native provider (local processing)
 * - Web: configurable provider mode (native/http/hybrid)
 */

import { isDesktop } from './platformAdapter';
import type { ExcelMergeOptions } from '@infra/excel-tools';
import { httpExcelToolsProvider, resolveExcelToolsProviders } from '@infra/excel-tools';

export interface ToolResult {
  success: boolean;
  outputFile?: string;
  outputBlob?: Blob;
  error?: string;
  logs?: string[];
}

export interface PythonStatus {
  available: boolean;
  version?: string;
  dependenciesInstalled?: boolean;
  missingDependencies?: string[];
}

/**
 * Check if Excel/Python tooling is available in the current runtime.
 */
export async function checkPythonStatus(): Promise<PythonStatus> {
  if (isDesktop && window.electronAPI) {
    try {
      const pythonResult = await (window as any).electronAPI?.invoke?.('python:isAvailable') ?? {
        available: false,
      };

      return {
        available: pythonResult.available ?? false,
        version: pythonResult.version,
        dependenciesInstalled: true,
        missingDependencies: [],
      };
    } catch {
      return { available: false };
    }
  }

  const remoteHealthy = await httpExcelToolsProvider.checkHealth();
  return {
    available: remoteHealthy,
    version: remoteHealthy ? 'Server' : undefined,
    dependenciesInstalled: remoteHealthy,
  };
}

/**
 * Merge Excel sheets into one combined sheet.
 */
export async function mergeExcelSheets(
  inputFile: File | string,
  options?: ExcelMergeOptions,
): Promise<ToolResult> {
  if (inputFile instanceof File) {
    try {
      const { mergeProvider } = resolveExcelToolsProviders();
      const outputBlob = await mergeProvider.mergeExcel(inputFile, options);

      return {
        success: true,
        outputBlob,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (isDesktop && typeof inputFile === 'string') {
    try {
      const result = await (window as any).electronAPI?.invoke?.('python:mergeExcel', inputFile);

      if (result?.success) {
        return {
          success: true,
          outputFile: result.outputFile,
          logs: result.output?.split('\n') ?? [],
        };
      }

      return {
        success: false,
        error: result?.error ?? 'Unknown error',
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return {
    success: false,
    error: 'Invalid input: expected File object or path string on desktop.',
  };
}

/**
 * Unlock protected Excel file.
 */
export async function unlockExcel(inputFile: File | string, outputFileName?: string): Promise<ToolResult> {
  if (isDesktop && typeof inputFile === 'string') {
    try {
      const result = await (window as any).electronAPI?.invoke?.('python:runTool', {
        tool: 'excel-unlock',
        inputFile,
        outputFile: outputFileName,
      });

      if (result?.success) {
        return {
          success: true,
          outputFile: result.outputFile,
        };
      }

      return {
        success: false,
        error: result?.error ?? 'Unknown error',
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (!(inputFile instanceof File)) {
    return {
      success: false,
      error: 'Web mode requires File object, not path string.',
    };
  }

  try {
    const { unlockProvider } = resolveExcelToolsProviders();
    const outputBlob = await unlockProvider.unlockExcel(inputFile);

    return {
      success: true,
      outputBlob,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const toolsAdapter = {
  checkPythonStatus,
  mergeExcelSheets,
  unlockExcel,
};

export default toolsAdapter;
