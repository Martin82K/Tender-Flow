/** @vitest-environment node */

import { afterEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import {
  analyzeWorkbookFile,
  buildComparisonWorkbook,
  safeNumericValue,
} from '../desktop/main/services/bidComparisonEngine';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bid-comparison-'));
  tempDirs.push(dir);
  return dir;
};

const writeWorkbook = async (
  filePath: string,
  rows: ExcelJS.CellValue[][],
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('VV');

  rows.forEach((rowValues, rowIndex) => {
    rowValues.forEach((value, columnIndex) => {
      sheet.getRow(rowIndex + 1).getCell(columnIndex + 1).value = value;
    });
  });

  await workbook.xlsx.writeFile(filePath);
};

const buildRows = (
  priceA: ExcelJS.CellValue,
  priceB: ExcelJS.CellValue,
): ExcelJS.CellValue[][] => [
  ['Soupis prací'],
  [],
  [
    'PČ',
    'Typ',
    'Kód',
    'Popis',
    'MJ',
    'Množství',
    'J.cena [CZK]',
    'Cena celkem [CZK]',
  ],
  ['', 'R', '', 'REKAPITULACE', '', '', '', ''],
  ['1', 'K', 'A-001', 'Položka A', 'm2', 2, priceA, ''],
  ['2', 'K', '', 'Položka B', 'm2', 3, priceB, ''],
];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe('bidComparisonEngine', () => {
  it('safeNumericValue ignoruje vzorce v buňce', () => {
    const formulaValue: ExcelJS.CellFormulaValue = {
      formula: 'A1*B1',
      result: 42,
    };

    expect(safeNumericValue(formulaValue)).toBeNull();
    expect(safeNumericValue('1 234,50')).toBe(1234.5);
  });

  it('analyzeWorkbookFile správně detekuje K řádky a oceněné řádky', async () => {
    const tempDir = await createTempDir();
    const workbookPath = path.join(tempDir, 'analyza.xlsx');

    await writeWorkbook(
      workbookPath,
      buildRows(
        150,
        {
          formula: 'G5*1',
          result: 180,
        } as ExcelJS.CellFormulaValue,
      ),
    );

    const analysis = await analyzeWorkbookFile(workbookPath);

    expect(analysis.headerRow).toBe(3);
    expect(analysis.kRows).toBe(2);
    expect(analysis.pricedKRows).toBe(1);
    expect(analysis.isValidTemplate).toBe(true);
    expect(analysis.columnMap.typ).toBeGreaterThan(0);
    expect(analysis.columnMap.jcena).toBeGreaterThan(0);
  });

  it('buildComparisonWorkbook doplní sloupce pro nabídky a páruje K položky podle kódu/PČ', async () => {
    const tempDir = await createTempDir();
    const zadaniPath = path.join(tempDir, 'zadani.xlsx');
    const offerDrywallPath = path.join(tempDir, 'drywall.xlsx');
    const offerPbkPath = path.join(tempDir, 'pbk.xlsx');

    await writeWorkbook(zadaniPath, buildRows('', ''));
    await writeWorkbook(offerDrywallPath, buildRows(100, 200));
    await writeWorkbook(offerPbkPath, buildRows(120, ''));

    const result = await buildComparisonWorkbook({
      zadaniPath,
      offers: [
        {
          supplierName: 'Drywall',
          displayLabel: 'Drywall (K1 v1)',
          filePath: offerDrywallPath,
          round: 1,
          variant: 1,
        },
        {
          supplierName: 'PBK',
          displayLabel: 'PBK (K1 v1)',
          filePath: offerPbkPath,
          round: 1,
          variant: 1,
        },
      ],
    });

    expect(result.pocetPolozek).toBe(2);
    expect(result.suppliers['Drywall (K1 v1)']?.sparovano).toBe(2);
    expect(result.suppliers['PBK (K1 v1)']?.sparovano).toBe(1);
    expect(result.suppliers['PBK (K1 v1)']?.nesparovano).toContain('2');

    const outputWorkbook = new ExcelJS.Workbook();
    await outputWorkbook.xlsx.load(result.outputBuffer);
    const outputSheet = outputWorkbook.getWorksheet(1);
    if (!outputSheet) {
      throw new Error('Výstupní workbook neobsahuje list.');
    }

    expect(outputSheet.getCell('I5').value).toBe(100);
    expect(outputSheet.getCell('K5').value).toBe(120);

    const cellJ5 = outputSheet.getCell('J5').value as ExcelJS.CellFormulaValue;
    const cellJ4 = outputSheet.getCell('J4').value as ExcelJS.CellFormulaValue;
    const cellL6 = outputSheet.getCell('L6').value;

    expect(cellJ5.formula).toBe('I5*F5');
    expect(cellJ4.formula).toBe('J5+J6');
    expect(cellL6 == null || cellL6 === '').toBe(true);
  });
});
