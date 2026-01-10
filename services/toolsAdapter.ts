/**
 * Tools Adapter
 * 
 * Unified service for Excel/PDF tools that switches between:
 * - Desktop: Local Python execution
 * - Web: Remote API calls (existing server_py Flask API)
 */

import { isDesktop } from './platformAdapter';

const EXCEL_TOOLS_URL = 'http://localhost:5001'; // Existing Python server

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
 * Check if Python tools are available
 */
export async function checkPythonStatus(): Promise<PythonStatus> {
    if (isDesktop && window.electronAPI) {
        // Desktop: check local Python
        try {
            const [available, deps] = await Promise.all([
                (window.electronAPI as any).python?.isAvailable?.() ??
                window.electronAPI.app.getVersion().then(() => ({ available: false })),
                Promise.resolve({ installed: false, missing: [] }),
            ]);

            // Use IPC invoke for Python status
            const pythonResult = await (window as any).electronAPI?.invoke?.('python:isAvailable') ??
                { available: false };

            return {
                available: pythonResult.available ?? false,
                version: pythonResult.version,
                dependenciesInstalled: true, // Assume true for now
                missingDependencies: [],
            };
        } catch (e) {
            return { available: false };
        }
    }

    // Web: check if Python server is running
    try {
        const response = await fetch(`${EXCEL_TOOLS_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
            return {
                available: true,
                version: 'Server',
                dependenciesInstalled: true,
            };
        }
    } catch {
        // Server not reachable
    }

    return { available: false };
}

/**
 * Merge Excel sheets into one combined sheet
 * Uses native ExcelService for browser/desktop (no external server needed)
 */
export async function mergeExcelSheets(
    inputFile: File | string,
    options?: {
        sheetsToInclude?: string[];
        headerMapping?: Record<number, string>;
        applyFilter?: boolean;
        freezeHeader?: boolean;
        showGridlines?: boolean;
        onProgress?: (message: string) => void;
        onProgressUpdate?: (progress: number) => void;
    }
): Promise<ToolResult> {
    // If it's a File object, use native ExcelService (works in browser and desktop)
    if (inputFile instanceof File) {
        try {
            // Dynamic import to avoid bundling issues
            const { ExcelService } = await import('./excelMergerService');

            // Analyze file to get sheet names if not provided
            let sheetsToInclude = options?.sheetsToInclude;
            if (!sheetsToInclude || sheetsToInclude.length === 0) {
                const allSheets = await ExcelService.analyzeFile(inputFile);
                sheetsToInclude = allSheets;
            }

            const blob = await ExcelService.mergeSheets(
                inputFile,
                sheetsToInclude,
                options?.onProgress,
                options?.onProgressUpdate,
                options?.headerMapping,
                options?.applyFilter ?? false,
                options?.freezeHeader ?? false,
                options?.showGridlines ?? true
            );

            return {
                success: true,
                outputBlob: blob,
            };
        } catch (e) {
            return {
                success: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    // Desktop with file path: use local Python (fallback)
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
 * Unlock protected Excel file
 */
export async function unlockExcel(
    inputFile: File | string,
    outputFileName?: string
): Promise<ToolResult> {
    if (isDesktop && typeof inputFile === 'string') {
        // Desktop: use local Python
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

    // Web: upload to server
    if (!(inputFile instanceof File)) {
        return {
            success: false,
            error: 'Web mode requires File object, not path string.',
        };
    }

    try {
        const formData = new FormData();
        formData.append('file', inputFile);

        const response = await fetch(`${EXCEL_TOOLS_URL}/unlock`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            return {
                success: false,
                error: error || `HTTP ${response.status}`,
            };
        }

        const blob = await response.blob();
        return {
            success: true,
            outputBlob: blob,
        };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

// Export combined adapter
export const toolsAdapter = {
    checkPythonStatus,
    mergeExcelSheets,
    unlockExcel,
};

export default toolsAdapter;
