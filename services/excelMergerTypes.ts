/**
 * Excel Merger Pro Types
 * Types for the Excel sheet merging functionality
 */

export interface ExcelSheetInfo {
    name: string;
    rowCount: number;
    isSelected: boolean;
}

export interface ProcessingStatus {
    step: 'idle' | 'analyzing' | 'configuring' | 'merging' | 'completed' | 'error';
    message?: string;
    progress?: number;
}

export type HeaderMapping = Record<number, string>;

export interface MergeOptions {
    sheetsToInclude: string[];
    headerMapping?: HeaderMapping;
    applyFilter?: boolean;
    freezeHeader?: boolean;
    showGridlines?: boolean;
    onProgress?: (message: string) => void;
    onProgressUpdate?: (progress: number) => void;
}

export interface MergeResult {
    success: boolean;
    blob?: Blob;
    error?: string;
    totalRows?: number;
}
