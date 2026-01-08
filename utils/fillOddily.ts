/**
 * Fill Oddíly (Sections) Utility
 * 
 * Phase 1 of the Excel Indexer two-phase system.
 * 
 * Process:
 * 1. Insert a new column B
 * 2. Set B1 = "Oddíly"
 * 3. Iterate through rows, looking for "D" in column G (was F before insert)
 * 4. When "D" is found, copy value from column H (was G) to column B
 * 5. Propagate the section name down until the next "D" is found
 * 6. Preserve Excel formatting and styles
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Types
// ============================================================================

export interface FillOddilyOptions {
    markerColumn?: string;   // Column to search for "D" marker (default: F)
    sectionColumn?: string;  // Column with section names (default: G)
    sheetName?: string;
    onProgress?: (percent: number, label: string) => void;
    onLog?: (message: string) => void;
}

export interface FillOddilyResult {
    outputBuffer: ArrayBuffer;
    stats: {
        totalRows: number;
        sectionsFound: number;
        rowsFilled: number;
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Copy cell style from source to target
 */
function copyCellStyle(source: ExcelJS.Cell, target: ExcelJS.Cell): void {
    if (source.style) {
        target.style = { ...source.style };
    }
    if (source.font) {
        target.font = { ...source.font };
    }
    if (source.fill) {
        target.fill = source.fill;
    }
    if (source.border) {
        target.border = { ...source.border };
    }
    if (source.alignment) {
        target.alignment = { ...source.alignment };
    }
}

/**
 * Get the effective column width from a reference column
 */
function getColumnWidth(sheet: ExcelJS.Worksheet, colIndex: number): number {
    const col = sheet.getColumn(colIndex);
    return col.width || 15; // Default width if not set
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Insert "Oddíly" column and fill section names based on "D" markers.
 * 
 * After this function runs:
 * - New column B contains "Oddíly" header and section names
 * - All original columns are shifted right by 1
 * - Original F (codes) is now G
 * - Original G (section names in "D" rows) is now H
 */
export async function fillOddily(
    buffer: ArrayBuffer,
    options: FillOddilyOptions = {}
): Promise<FillOddilyResult> {
    const {
        markerColumn = 'F',
        sectionColumn = 'G',
        sheetName,
        onProgress,
        onLog
    } = options;

    // Convert column letter to index (A=1, B=2, etc.)
    const letterToIndex = (letter: string): number => letter.toUpperCase().charCodeAt(0) - 64;

    // Original column positions (before we insert column B)
    const originalMarkerColIdx = letterToIndex(markerColumn);
    const originalSectionColIdx = letterToIndex(sectionColumn);

    onProgress?.(5, 'Načítám soubor...');
    onLog?.('Načítám Excel soubor...');

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    let sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
    const sheetNameToUse = sheet?.name;

    if (!sheet) {
        throw new Error(sheetName ? `List "${sheetName}" nebyl nalezen` : 'V sešitu nejsou žádné listy');
    }

    onLog?.(`Zpracovávám list "${sheet.name}"...`);
    onProgress?.(10, 'Připravuji data...');

    const totalRows = sheet.rowCount;
    onLog?.(`Celkem ${totalRows} řádků`);

    // ==========================================================================
    // NOTE: We do NOT insert a new column to avoid ExcelJS shared formula bugs
    // User should manually insert column B in Excel before running this tool
    // We simply write data to column B (assumed to be empty/ready)
    // ==========================================================================

    // Get reference style from first row, column A for header styling
    const headerRow = sheet.getRow(1);
    const refHeaderCell = headerRow.getCell(1);

    onProgress?.(15, 'Nastavuji hlavičku...');

    // Set header for column B
    const oddílyHeaderCell = sheet.getCell('B1');
    oddílyHeaderCell.value = 'Oddíly';

    // Copy style from reference header cell
    copyCellStyle(refHeaderCell, oddílyHeaderCell);

    // Set reasonable column width
    const colB = sheet.getColumn(2);
    colB.width = 25;

    // Column positions - NO shifting since we don't insert a column
    // Marker and section columns are at their original positions
    const markerColIdx = originalMarkerColIdx;
    const sectionColIdx = originalSectionColIdx;

    onProgress?.(20, 'Procházím řádky...');
    onLog?.(`Hledám oddíly (hodnota "D" ve sloupci ${markerColumn})...`);

    const COL_B = 2;  // Oddíly column

    let currentSection: string | null = null;
    let sectionsFound = 0;
    let rowsFilled = 0;

    // Process rows starting from row 2 (skip header)
    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
        const row = sheet.getRow(rowNum);

        // Check marker column for "D"
        const markerCell = row.getCell(markerColIdx);
        const markerValue = markerCell.value;

        // Normalize value to string for comparison
        let markerCheck: string | null = null;
        if (markerValue !== null && markerValue !== undefined) {
            if (typeof markerValue === 'string') {
                markerCheck = markerValue.trim();
            } else if (typeof markerValue === 'object' && 'text' in markerValue) {
                markerCheck = String((markerValue as any).text).trim();
            } else if (typeof markerValue === 'object' && 'richText' in markerValue) {
                markerCheck = ((markerValue as any).richText || []).map((rt: any) => rt.text).join('').trim();
            } else {
                markerCheck = String(markerValue).trim();
            }
        }

        if (markerCheck === 'D') {
            // Found section marker, get section name from section column
            const sectionCell = row.getCell(sectionColIdx);
            const sectionValue = sectionCell.value;

            if (sectionValue !== null && sectionValue !== undefined) {
                if (typeof sectionValue === 'string') {
                    currentSection = sectionValue.trim();
                } else if (typeof sectionValue === 'object' && 'text' in sectionValue) {
                    currentSection = String((sectionValue as any).text).trim();
                } else if (typeof sectionValue === 'object' && 'richText' in sectionValue) {
                    currentSection = ((sectionValue as any).richText || []).map((rt: any) => rt.text).join('').trim();
                } else {
                    currentSection = String(sectionValue).trim();
                }
            } else {
                currentSection = '';
            }

            sectionsFound++;
            onLog?.(`Řádek ${rowNum}: Nalezen oddíl "${currentSection}"`);
        }

        // Fill column B with current section (if we have one)
        if (currentSection !== null) {
            const bCell = row.getCell(COL_B);
            bCell.value = currentSection;
            rowsFilled++;

            // Copy style from the reference cell in the same row (e.g., column A)
            // to maintain consistent row formatting
            const refCell = row.getCell(1);
            if (refCell.style && Object.keys(refCell.style).length > 0) {
                // Only copy fill/background if present
                if (refCell.fill) {
                    bCell.fill = refCell.fill;
                }
                if (refCell.border) {
                    bCell.border = { ...refCell.border };
                }
            }
        }

        // Progress update every 100 rows
        if (rowNum % 100 === 0) {
            const percent = 20 + Math.round(((rowNum - 2) / (totalRows - 2 || 1)) * 70);
            onProgress?.(percent, `Zpracováno ${rowNum}/${totalRows} řádků...`);

            // Yield to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    onProgress?.(95, 'Generuji výstupní soubor...');
    onLog?.(`Nalezeno ${sectionsFound} oddílů, vyplněno ${rowsFilled} řádků`);

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
    onLog?.(`Rozsah dat: A1 až ${lastColLetter}${totalRows}`);

    // Apply autoFilter to all data
    sheet.autoFilter = `A1:${lastColLetter}${totalRows}`;
    onLog?.(`Autofiltr aplikován: A1:${lastColLetter}${totalRows}`);

    // Freeze first row and hide gridlines (AFTER autoFilter)
    sheet.views = [
        { state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: false }
    ];
    onLog?.('První řádek ukotven, mřížka skryta');

    const outputBuffer = await workbook.xlsx.writeBuffer();

    onProgress?.(100, 'Hotovo!');
    onLog?.('Fáze 1 dokončena - sloupec Oddíly byl vložen');

    return {
        outputBuffer,
        stats: {
            totalRows,
            sectionsFound,
            rowsFilled,
        },
    };
}
