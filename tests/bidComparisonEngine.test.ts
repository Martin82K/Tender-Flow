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
      date1904: false,
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
          date1904: false,
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
    expect(result.matrix).toHaveLength(2);
    expect(result.matrix[0].popis).toBe('Položka A');
    expect(result.matrix[0].offers['Drywall (K1 v1)']?.jcena).toBe(100);
    expect(result.matrix[0].offers['Drywall (K1 v1)']?.celkem).toBe(200);
    expect(result.matrix[1].offers['PBK (K1 v1)']?.matched).toBe(false);

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
    const bestTotalFill = outputSheet.getCell('J5').fill as ExcelJS.FillPattern;

    expect(cellJ5.formula).toBe('I5*F5');
    expect(cellJ4.formula).toBe('SUM(J5,J6)');
    expect(cellL6).toBe('-');
    expect(bestTotalFill.fgColor?.argb).toBe('FFC6EFCE');
  });

  it('buildComparisonWorkbook vytvoří porovnání pouze z nabídek bez zadání', async () => {
    const tempDir = await createTempDir();
    const offerDrywallPath = path.join(tempDir, 'drywall.xlsx');
    const offerPbkPath = path.join(tempDir, 'pbk.xlsx');

    await writeWorkbook(offerDrywallPath, buildRows(100, 200));
    await writeWorkbook(offerPbkPath, buildRows(120, ''));

    const result = await buildComparisonWorkbook({
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

    expect(result.sourceMode).toBe('offers_only');
    expect(result.pocetPolozek).toBe(2);
    expect(result.suppliers['Drywall (K1 v1)']?.sparovano).toBe(2);
    expect(result.suppliers['PBK (K1 v1)']?.sparovano).toBe(1);
    expect(result.matrix[0].offers['PBK (K1 v1)']?.jcena).toBe(120);
    expect(result.matrix[1].offers['PBK (K1 v1)']?.matched).toBe(false);

    const outputWorkbook = new ExcelJS.Workbook();
    await outputWorkbook.xlsx.load(result.outputBuffer);
    const outputSheet = outputWorkbook.getWorksheet('Porovnání nabídek');
    expect(outputSheet).toBeDefined();
    expect(outputSheet?.getCell('A1').value).toBe('Porovnání nabídek bez souboru zadání');
    expect(outputSheet?.getCell('G5').value).toBe(100);
    expect(outputSheet?.getCell('I5').value).toBe(120);
    expect(outputSheet?.getCell('J6').value).toBe('-');
  });

  it('buildComparisonWorkbook zapíše doporučení agenta do samostatného listu', async () => {
    const tempDir = await createTempDir();
    const zadaniPath = path.join(tempDir, 'zadani.xlsx');
    const offerPath = path.join(tempDir, 'offer.xlsx');

    await writeWorkbook(zadaniPath, buildRows('', ''));
    await writeWorkbook(offerPath, buildRows(100, 200));

    const result = await buildComparisonWorkbook({
      zadaniPath,
      offers: [
        {
          supplierName: 'Drywall',
          displayLabel: 'Drywall (K1 v1)',
          filePath: offerPath,
          round: 1,
          variant: 1,
        },
      ],
      agentRecommendation: {
        summary: 'Drywall má nejnižší jednotkové ceny bez zásadních výjimek.',
        recommendedSupplier: 'Drywall',
        nextSteps: ['Prověřit platnost nabídky.'],
        risks: [
          {
            severity: 'medium',
            itemKod: 'A-001',
            supplierName: 'Drywall',
            title: 'Kontrola rozsahu',
            detail: 'Ověřit, že jednotková cena zahrnuje shodný rozsah.',
          },
        ],
      },
    });

    const outputWorkbook = new ExcelJS.Workbook();
    await outputWorkbook.xlsx.load(result.outputBuffer);
    const recommendationSheet = outputWorkbook.getWorksheet('Agent doporučení');

    expect(recommendationSheet).toBeDefined();
    expect(recommendationSheet?.getCell('A2').value).toBe('Shrnutí');
    expect(recommendationSheet?.getCell('B2').value).toBe('Drywall');
    expect(String(recommendationSheet?.getCell('C2').value)).toContain('nejnižší');
  });
});
