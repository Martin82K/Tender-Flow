/**
 * Index Matcher Utility
 * 
 * Matches budget codes from construction spreadsheets against an index/codebook
 * and fills descriptions automatically.
 * 
 * Process:
 * 1. Load index (codebook) from Excel: code → description mapping
 * 2. Iterate through budget file:
 *    - Find numeric codes in column F
 *    - Match 3-digit prefix (or 2-digit fallback) against index
 *    - Fill description in column B
 *    - Propagate description to subsequent rows until next code
 */

import * as XLSX from 'xlsx';

// ============================================================================
// Types
// ============================================================================

export type IndexMap = Map<string, string>;

export interface ProgressReporter {
  (percent: number, label: string): void;
}

export interface LogReporter {
  (message: string): void;
}

export interface FillDescriptionsOptions {
  codeColumn?: string;      // Default: 'F'
  descColumn?: string;      // Default: 'B'
  startRow?: number;        // Default: 1 (1-indexed)
  sheetName?: string;       // Default: first sheet
  onProgress?: ProgressReporter;
  onLog?: LogReporter;
}

export interface ProcessResult {
  outputBuffer: ArrayBuffer;
  stats: {
    totalRows: number;
    codesFound: number;
    matchesFound: number;
    descriptionsWritten: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

const DIGITS_ONLY = /^\d+$/;

/**
 * Normalize a cell value to a numeric code string.
 * Returns null if the value is not a valid numeric code.
 */
export function normalizeCode(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle numbers
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return String(value);
    }
    // Float that is actually an integer (e.g., 311236101.0)
    if (Number.isFinite(value) && Math.floor(value) === value) {
      return String(Math.floor(value));
    }
    return null;
  }

  // Handle strings
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // Check if it's a pure numeric string
    if (DIGITS_ONLY.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  return null;
}

/**
 * Find the best matching prefix in the index.
 * Prefers 3-digit prefix, falls back to 2-digit.
 */
export function bestPrefixMatch(
  code: string,
  indexMap: IndexMap
): { prefix: string; description: string } | null {
  // Try 3-digit prefix first
  if (code.length >= 3) {
    const p3 = code.slice(0, 3);
    if (indexMap.has(p3)) {
      return { prefix: p3, description: indexMap.get(p3)! };
    }
  }

  // Fall back to 2-digit prefix
  if (code.length >= 2) {
    const p2 = code.slice(0, 2);
    if (indexMap.has(p2)) {
      return { prefix: p2, description: indexMap.get(p2)! };
    }
  }

  return null;
}

/**
 * Convert column letter to 0-based index.
 * E.g., 'A' -> 0, 'B' -> 1, 'F' -> 5
 */
function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Load index (codebook) from an Excel workbook.
 * Expects two columns: code and description.
 * Returns a Map of code -> description.
 */
export function loadIndexFromWorkbook(
  workbook: XLSX.WorkBook,
  sheetName?: string,
  onLog?: LogReporter
): IndexMap {
  const targetSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  
  if (!sheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook`);
  }

  onLog?.(`Načítám číselník z listu "${targetSheet}"...`);

  // Convert sheet to array of arrays
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const indexMap: IndexMap = new Map();

  for (const row of data) {
    if (!Array.isArray(row) || row.length < 2) {
      continue;
    }

    // Find first two non-empty values in the row
    const nonEmpty = row.filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ''
    );

    if (nonEmpty.length < 2) {
      continue;
    }

    const rawKey = nonEmpty[0];
    const rawDesc = nonEmpty[1];

    const key = String(rawKey).trim();
    const desc = String(rawDesc).trim();

    if (key && desc) {
      indexMap.set(key, desc);
    }
  }

  onLog?.(`Načteno ${indexMap.size} položek z číselníku`);
  return indexMap;
}

/**
 * Load index from an ArrayBuffer (Excel file).
 */
export function loadIndexFromBuffer(
  buffer: ArrayBuffer,
  sheetName?: string,
  onLog?: LogReporter
): IndexMap {
  const workbook = XLSX.read(buffer, { type: 'array' });
  return loadIndexFromWorkbook(workbook, sheetName, onLog);
}

/**
 * Fill descriptions in a budget spreadsheet based on the index.
 * 
 * Logic:
 * - Iterates through rows starting from startRow
 * - When a numeric code is found in codeColumn (F), looks up its prefix in the index
 * - If found, writes the description to descColumn (B)
 * - Continues writing the same description to subsequent rows until a new code is found
 */
export async function fillDescriptions(
  buffer: ArrayBuffer,
  indexMap: IndexMap,
  options: FillDescriptionsOptions = {}
): Promise<ProcessResult> {
  const {
    codeColumn = 'F',
    descColumn = 'B',
    startRow = 1,
    sheetName,
    onProgress,
    onLog,
  } = options;

  onProgress?.(5, 'Načítám rozpočtový soubor...');
  onLog?.('Načítám rozpočtový soubor...');

  const workbook = XLSX.read(buffer, { type: 'array' });
  const targetSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];

  if (!sheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook`);
  }

  onLog?.(`Zpracovávám list "${targetSheet}"...`);

  // Get sheet range
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = range.e.r + 1; // 1-indexed
  const totalRows = maxRow - startRow + 1;

  const codeColIndex = colLetterToIndex(codeColumn.toUpperCase());
  const descColIndex = colLetterToIndex(descColumn.toUpperCase());

  let currentDescription: string | null = null;
  let codesFound = 0;
  let matchesFound = 0;
  let descriptionsWritten = 0;

  onProgress?.(10, 'Procházím řádky...');
  onLog?.(`Celkem ${totalRows} řádků ke zpracování`);

  for (let rowNum = startRow; rowNum <= maxRow; rowNum++) {
    // Get cell address for code column
    const codeAddr = XLSX.utils.encode_cell({ r: rowNum - 1, c: codeColIndex });
    const codeCell = sheet[codeAddr];
    const codeValue = codeCell?.v;

    const normalizedCode = normalizeCode(codeValue);

    if (normalizedCode) {
      codesFound++;
      const match = bestPrefixMatch(normalizedCode, indexMap);

      if (match) {
        currentDescription = match.description;
        matchesFound++;
        onLog?.(`Řádek ${rowNum}: Kód ${normalizedCode} → prefix ${match.prefix} → "${match.description}"`);
      } else {
        currentDescription = null;
        onLog?.(`Řádek ${rowNum}: Kód ${normalizedCode} → bez shody v číselníku`);
      }
    }

    // Write description if we have one
    if (currentDescription) {
      const descAddr = XLSX.utils.encode_cell({ r: rowNum - 1, c: descColIndex });
      sheet[descAddr] = { v: currentDescription, t: 's' };
      descriptionsWritten++;
    }

    // Update progress every 100 rows
    if (rowNum % 100 === 0 || rowNum === maxRow) {
      const percent = 10 + Math.round((rowNum / maxRow) * 80);
      onProgress?.(percent, `Zpracováno ${rowNum}/${maxRow} řádků...`);
      
      // Yield to prevent UI freeze
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(92, 'Generuji výstupní soubor...');
  onLog?.(`Nalezeno ${codesFound} kódů, ${matchesFound} shod, zapsáno ${descriptionsWritten} popisů`);

  // Update sheet range if we wrote outside the original range
  const newRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  if (descColIndex > newRange.e.c) {
    newRange.e.c = descColIndex;
    sheet['!ref'] = XLSX.utils.encode_range(newRange);
  }

  // Generate output
  const outputBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;

  onProgress?.(100, 'Hotovo!');
  onLog?.('Zpracování dokončeno!');

  return {
    outputBuffer,
    stats: {
      totalRows,
      codesFound,
      matchesFound,
      descriptionsWritten,
    },
  };
}
