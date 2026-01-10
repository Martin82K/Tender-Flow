/**
 * Excel Merger Pro Service
 * Native implementation for merging Excel sheets with formatting preservation
 * Originally from: https://github.com/Martin82K/ExcelMerger-Pro
 */
import ExcelJS from 'exceljs';
import { HeaderMapping } from './excelMergerTypes';

export class ExcelService {
  /**
   * Analyzes an uploaded Excel file to extract sheet names and basic info.
   */
  static async analyzeFile(file: File): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    return workbook.worksheets.map(ws => ws.name);
  }

  /**
   * Helper to shift column letters (e.g., A -> B, Z -> AA)
   */
  private static shiftColumn(colName: string, shift: number): string {
    let colIdx = 0;
    const cleanCol = colName.replace(/\$/g, '');
    for (let i = 0; i < cleanCol.length; i++) {
      colIdx = colIdx * 26 + (cleanCol.charCodeAt(i) - 64);
    }
    colIdx += shift;

    let newColName = '';
    while (colIdx > 0) {
      let rem = (colIdx - 1) % 26;
      newColName = String.fromCharCode(65 + rem) + newColName;
      colIdx = Math.floor((colIdx - rem) / 26);
    }
    return (colName.startsWith('$') ? '$' : '') + newColName;
  }

  /**
   * Adjusts formula string to account for column and row shifts.
   */
  private static transformFormula(formula: string, colShift: number, rowShift: number, sheetsInFile: string[]): string {
    if (!formula) return '';

    let cleanedFormula = formula;
    sheetsInFile.forEach(name => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`'?${escapedName}'?!`, 'g');
      cleanedFormula = cleanedFormula.replace(regex, '');
    });

    return cleanedFormula.replace(/(\$?[A-Z]{1,3})(\$?[0-9]+)/g, (match, col, row) => {
      if (match.length > 10) return match;
      const isAbsoluteRow = row.startsWith('$');
      const newCol = this.shiftColumn(col, colShift);

      let newRow = row;
      if (!isAbsoluteRow) {
        newRow = (parseInt(row) + rowShift).toString();
      } else {
        const rowNum = parseInt(row.substring(1));
        if (rowNum > 2) {
          newRow = '$' + (rowNum + rowShift).toString();
        }
      }
      return newCol + newRow;
    });
  }

  /**
   * Merges selected sheets into a single master sheet with formatting and formula preservation.
   */
  static async mergeSheets(
    file: File,
    sheetsToInclude: string[],
    onProgress?: (message: string) => void,
    onProgressUpdate?: (progress: number) => void,
    headerMapping?: HeaderMapping,
    applyFilter: boolean = false,
    freezeHeader: boolean = false,
    showGridlines: boolean = true
  ): Promise<Blob> {
    onProgress?.('Načítám zdrojový soubor...');
    onProgressUpdate?.(2);
    const sourceWorkbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await sourceWorkbook.xlsx.load(arrayBuffer);
    onProgressUpdate?.(8);

    const allSheetNames = sourceWorkbook.worksheets.map(ws => ws.name);
    const targetWorkbook = new ExcelJS.Workbook();
    const targetSheet = targetWorkbook.addWorksheet('Merged Data');

    // Apply view settings (freeze panes and gridlines)
    targetSheet.views = [
      {
        state: freezeHeader ? 'frozen' : 'normal',
        xSplit: 0,
        ySplit: freezeHeader ? 1 : 0,
        showGridLines: showGridlines,
        activeCell: 'A2'
      }
    ];

    let currentRow = 1;
    let maxColsOverall = 0;

    const copyCellStyle = (srcCell: ExcelJS.Cell, destCell: ExcelJS.Cell) => {
      if (srcCell.style) {
        // Deep clone the style object to avoid reference issues
        destCell.style = JSON.parse(JSON.stringify(srcCell.style));
      }

      // Explicitly handle number formats which are sometimes lost in JSON stringify
      if (srcCell.numFmt) {
        destCell.numFmt = srcCell.numFmt;
      }
    };

    onProgress?.(`Zahájeno slučování ${sheetsToInclude.length} listů...`);
    let totalRowsProcessed = 0;

    // Estimate total rows for progress tracking
    let totalExpectedRows = 0;
    sheetsToInclude.forEach(name => {
      const ws = sourceWorkbook.getWorksheet(name);
      if (ws) totalExpectedRows += ws.rowCount || 0;
    });

    for (let i = 0; i < sheetsToInclude.length; i++) {
      const sheetName = sheetsToInclude[i];
      const sourceSheet = sourceWorkbook.getWorksheet(sheetName);
      if (!sourceSheet) {
        onProgress?.(`VAROVÁNÍ: List ${sheetName} nenalezen, přeskakuji.`);
        continue;
      }

      onProgress?.(`Čtu list: ${sheetName} (${i + 1}/${sheetsToInclude.length})`);

      let sheetMaxCol = 0;
      let sheetRowCount = sourceSheet.rowCount || 0;

      sourceSheet.eachRow({ includeEmpty: true }, (row) => {
        sheetMaxCol = Math.max(sheetMaxCol, row.actualCellCount || 0, row.cellCount || 0);
      });
      maxColsOverall = Math.max(maxColsOverall, sheetMaxCol);

      if (i > 0) {
        const separatorRow = targetSheet.getRow(currentRow);
        separatorRow.height = 20;
        const separatorCell = separatorRow.getCell(1);
        separatorCell.value = ` LIST: ${sheetName.toUpperCase()} `;
        separatorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        separatorCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
        separatorCell.alignment = { vertical: 'middle', horizontal: 'center' };

        try {
          targetSheet.mergeCells(currentRow, 1, currentRow, Math.max(13, sheetMaxCol + 1));
        } catch (e) { }
        currentRow++;
      }

      let rowsInThisSheet = 0;
      sourceSheet.eachRow({ includeEmpty: true }, (row) => {
        const targetRow = targetSheet.getRow(currentRow);
        if (row.height) targetRow.height = row.height;

        // Column 1: Source Sheet Name (metadata)
        const sourceNameCell = targetRow.getCell(1);
        sourceNameCell.value = row.number <= 1 ? '' : sheetName;
        sourceNameCell.font = { size: 8, color: { argb: 'FF94A3B8' } };

        const rowShift = currentRow - row.number;
        const colShift = 1;

        // Use a more reliable way to find the last cell
        const lastCol = Math.max(row.actualCellCount || 0, row.cellCount || 0);

        for (let c = 1; c <= lastCol; c++) {
          const cell = row.getCell(c);
          const destCell = targetRow.getCell(c + 1);

          if (cell.type === ExcelJS.ValueType.Formula) {
            const fValue = cell.value as ExcelJS.CellFormulaValue;
            try {
              const newFormula = this.transformFormula(fValue.formula, colShift, rowShift, allSheetNames);
              destCell.value = {
                formula: newFormula,
                result: fValue.result
              };
            } catch (e) {
              destCell.value = fValue.result;
            }
          } else {
            destCell.value = cell.value;
          }
          copyCellStyle(cell, destCell);
        }
        currentRow++;
        rowsInThisSheet++;
        totalRowsProcessed++;

        // Progress: 10% to 90%
        if (totalExpectedRows > 0) {
          const currentProgress = 10 + Math.floor((totalRowsProcessed / totalExpectedRows) * 80);
          onProgressUpdate?.(Math.min(90, currentProgress));
        }

        if (rowsInThisSheet % 500 === 0) {
          onProgress?.(`... kopíruji řádek ${rowsInThisSheet} / ${sheetRowCount}`);
        }
      });
      onProgress?.(`Dokončen list ${sheetName} (${rowsInThisSheet} řádků)`);
      currentRow++; // Spacing between sheets
    }

    if (headerMapping) {
      onProgress?.('Aplikuji uživatelskou hlavičku...');
      onProgressUpdate?.(92);
      const headerRow = targetSheet.getRow(1);
      headerRow.height = 24;
      for (let col = 1; col <= 16; col++) {
        const value = headerMapping[col];
        if (value) {
          const cell = headerRow.getCell(col);
          cell.value = value;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
          cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        }
      }
    }

    if (applyFilter) {
      onProgress?.('Nastavuji auto-filtry...');
      onProgressUpdate?.(94);
      targetSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, currentRow - 2), column: Math.max(13, maxColsOverall + 1) }
      };
    }

    onProgress?.('Optimalizuji šířku sloupců...');
    onProgressUpdate?.(96);
    targetSheet.getColumn(1).width = 15;
    const firstSheet = sourceWorkbook.getWorksheet(sheetsToInclude[0]);
    if (firstSheet) {
      firstSheet.columns.forEach((col, idx) => {
        if (col && col.width) targetSheet.getColumn(idx + 2).width = col.width;
      });
    }

    onProgress?.(`Generuji výsledný soubor (${totalRowsProcessed} řádků celkem)...`);
    onProgressUpdate?.(98);

    const buffer = await targetWorkbook.xlsx.writeBuffer();
    onProgressUpdate?.(100);
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
