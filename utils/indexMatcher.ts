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

import ExcelJS from 'exceljs';

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
  createRecapitulation?: boolean; // Create summary sheet
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

  // Handle ExcelJS CellValue objects
  if (typeof value === 'object') {
    // ExcelJS CellValue might be an object
    // If it's a formula
    if (value && 'result' in value) {
      const val = (value as any).result;
      if (typeof val === 'number') {
        if (Number.isInteger(val)) return String(val);
        if (Number.isFinite(val) && Math.floor(val) === val) return String(Math.floor(val));
      }
      if (typeof val === 'string') {
        return normalizeCode(val);
      }
      // result could be error or Date, ignore
    }

    // If rich text
    if (value && 'richText' in value && Array.isArray((value as any).richText)) {
      // Concatenate text parts
      const text = (value as any).richText.map((rt: any) => rt.text).join('');
      return normalizeCode(text);
    }

    // If text property exists (sometimes used)
    if (value && 'text' in value) {
      return normalizeCode((value as any).text);
    }

    return null;
  }

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

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Load index from an ArrayBuffer (Excel file) using ExcelJS.
 */
export async function loadIndexFromBuffer(
  buffer: ArrayBuffer,
  sheetName?: string,
  onLog?: LogReporter
): Promise<IndexMap> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const targetSheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];

  if (!targetSheet) {
    throw new Error(sheetName ? `Sheet "${sheetName}" not found` : 'No sheets found in workbook');
  }

  onLog?.(`Načítám číselník z listu "${targetSheet.name}"...`);

  const indexMap: IndexMap = new Map();

  // ExcelJS iterates rows. Note: ExcelJS rows are 1-indexed.
  targetSheet.eachRow((row, rowNumber) => {
    // We expect at least 2 columns.
    // getCell(1) -> Column A, getCell(2) -> Column B

    // Simple heuristic: get values from cell 1 and 2
    // We try to find the first two cells as Code/Desc

    // Let's grab values directly from first two columns
    // We need to resolve values (if formulas or rich text)

    const c1 = row.getCell(1).value;
    const c2 = row.getCell(2).value;

    // Basic extraction
    const extractStr = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object') {
        if ('result' in val) return extractStr(val.result);
        if ('text' in val) return val.text;
        if ('richText' in val) return val.richText.map((rt: any) => rt.text).join('');
      }
      return String(val);
    };

    const key = extractStr(c1).trim();
    const desc = extractStr(c2).trim();

    if (key && desc) {
      indexMap.set(key, desc);
    }
  });

  onLog?.(`Načteno ${indexMap.size} položek z číselníku`);
  return indexMap;
}

/**
 * Fill descriptions in a budget spreadsheet based on the index.
 * Uses ExcelJS to preserve styles.
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

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];

  if (!sheet) {
    throw new Error(sheetName ? `Sheet "${sheetName}" not found` : 'No sheets found');
  }

  onLog?.(`Zpracovávám list "${sheet.name}"...`);

  const totalRows = sheet.rowCount;
  const lastRow = sheet.rowCount;

  // Set header for description column
  const headerRow = sheet.getRow(1);
  const refHeaderCell = headerRow.getCell(1); // Column A header as style reference
  const descHeaderCell = sheet.getCell(`${descColumn}1`);
  descHeaderCell.value = 'Výběrová řízení';

  // Copy style from reference header cell
  if (refHeaderCell.style) {
    descHeaderCell.style = { ...refHeaderCell.style };
  }
  if (refHeaderCell.font) {
    descHeaderCell.font = { ...refHeaderCell.font };
  }
  if (refHeaderCell.fill) {
    descHeaderCell.fill = refHeaderCell.fill;
  }
  if (refHeaderCell.border) {
    descHeaderCell.border = { ...refHeaderCell.border };
  }
  if (refHeaderCell.alignment) {
    descHeaderCell.alignment = { ...refHeaderCell.alignment };
  }

  // Set column width for better readability
  const descColumnObj = sheet.getColumn(descColumn);
  descColumnObj.width = 30;

  onLog?.(`Hlavička "${descColumn}1" nastavena na "Výběrová řízení", šířka sloupce 30`);

  let currentDescription: string | null = null;
  let codesFound = 0;
  let matchesFound = 0;
  let descriptionsWritten = 0;

  onProgress?.(10, 'Procházím řádky...');
  onLog?.(`Celkem cca ${totalRows} řádků ke zpracování`);

  /* Recapitulation Logic */
  const recapMap = new Map<string, number>();

  for (let rowNum = startRow; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRow(rowNum);

    // Check code column
    const codeCell = row.getCell(codeColumn);
    const codeValue = codeCell.value;

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
      const descCell = row.getCell(descColumn);
      descCell.value = currentDescription;
      // Note: Styles are preserved by default in ExcelJS when just setting value.
      descriptionsWritten++;

      // Collect for recapitulation
      if (options.createRecapitulation) {
        const count = recapMap.get(currentDescription) || 0;
        recapMap.set(currentDescription, count + 1);
      }
    }

    // Update progress every 100 rows
    if (rowNum % 100 === 0) {
      const percent = 10 + Math.round(((rowNum - startRow) / (lastRow - startRow || 1)) * 75); // Adjusted to 75 to leave room for recap
      onProgress?.(percent, `Zpracováno ${rowNum}/${lastRow} řádků...`);

      // Yield
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Generate Recapitulation Sheet if requested
  if (options.createRecapitulation && recapMap.size > 0) {
    onProgress?.(90, 'Vytvářím list rekapitulace...');
    onLog?.(`Vytvářím rekapitulaci pro ${recapMap.size} unikátních položek.`);
    let recapSheet = workbook.getWorksheet("Rekapitulace VŘ");
    if (recapSheet) {
      workbook.removeWorksheet(recapSheet.id);
    }
    recapSheet = workbook.addWorksheet("Rekapitulace VŘ");

    // Header
    recapSheet.getRow(1).values = ["Popis položky", "Počet výskytů"];
    recapSheet.getRow(1).font = { bold: true };

    let rowIndex = 2;
    // Sort by description alphabetically
    const sortedEntries = Array.from(recapMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'cs'));

    for (const [desc, count] of sortedEntries) {
      recapSheet.getRow(rowIndex).values = [desc, count];
      rowIndex++;
    }

    // Auto-width for first column
    recapSheet.getColumn(1).width = 50;
    recapSheet.getColumn(2).width = 15;
  }

  onProgress?.(95, 'Generuji výstupní soubor...');
  onLog?.(`Nalezeno ${codesFound} kódů, ${matchesFound} shod, zapsáno ${descriptionsWritten} popisů`);

  // Detect the actual last column with data by scanning all rows
  let lastCol = 1;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > lastCol) lastCol = colNumber;
    });
  });

  // Convert column number to letter (handles columns beyond Z)
  const colToLetter = (col: number): string => {
    let letter = '';
    while (col > 0) {
      const mod = (col - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  };

  const lastColLetter = colToLetter(lastCol);
  onLog?.(`Rozsah dat: A1 až ${lastColLetter}${lastRow}`);

  // Apply autoFilter to all data
  sheet.autoFilter = `A1:${lastColLetter}${lastRow}`;
  onLog?.(`Autofiltr aplikován: A1:${lastColLetter}${lastRow}`);

  // Freeze first row and hide gridlines (AFTER autoFilter)
  sheet.views = [
    { state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: false }
  ];
  onLog?.('První řádek ukotven, mřížka skryta');

  const outputBuffer = await workbook.xlsx.writeBuffer();

  onProgress?.(100, 'Hotovo!');
  onLog?.('Zpracování dokončeno!');

  return {
    outputBuffer,
    stats: {
      totalRows: lastRow - startRow + 1,
      codesFound,
      matchesFound,
      descriptionsWritten,
    },
  };
}
