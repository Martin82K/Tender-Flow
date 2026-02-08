/** @vitest-environment node */

import { afterEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import { BidComparisonRunner } from '../desktop/main/services/bidComparisonRunner';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bid-runner-'));
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

const buildRows = (price: ExcelJS.CellValue): ExcelJS.CellValue[][] => [
  ['Soupis prací'],
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
  ['1', 'K', 'A-001', 'Položka A', 'm2', 2, price, ''],
];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe('BidComparisonRunner.detectInputs', () => {
  it('autodetekuje zadání i nabídku dodavatele včetně kola', async () => {
    const tempDir = await createTempDir();
    await writeWorkbook(
      path.join(tempDir, 'VV_k_vyplneni_zadani.xlsx'),
      buildRows(''),
    );
    await writeWorkbook(
      path.join(tempDir, 'VV_Drywall_kolo1.xlsx'),
      buildRows(125),
    );

    const runner = new BidComparisonRunner();
    const result = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    const zadaniFile = result.files.find((file) =>
      file.fileName.includes('zadani'),
    );
    const offerFile = result.files.find((file) =>
      file.fileName.includes('Drywall'),
    );

    expect(zadaniFile?.suggestedRole).toBe('zadani');
    expect(offerFile?.suggestedRole).toBe('offer');
    expect(offerFile?.suggestedSupplierName).toBe('Drywall');
    expect(offerFile?.suggestedRound).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('vrací warning pro dodavatele bez automaticky přiřazené nabídky', async () => {
    const tempDir = await createTempDir();
    await writeWorkbook(
      path.join(tempDir, 'VV_k_vyplneni_zadani.xlsx'),
      buildRows(''),
    );

    const runner = new BidComparisonRunner();
    const result = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'PBK Mont' }],
    });

    expect(
      result.warnings.some((warning) => warning.includes('PBK Mont')),
    ).toBe(true);
  });

  it('ignoruje podsložky obsahující archiv v názvu', async () => {
    const tempDir = await createTempDir();
    const archiveDir = path.join(tempDir, 'Nabidky_ARCHIV');
    await mkdir(archiveDir, { recursive: true });

    await writeWorkbook(
      path.join(tempDir, 'VV_k_vyplneni_zadani.xlsx'),
      buildRows(''),
    );
    await writeWorkbook(
      path.join(tempDir, 'VV_Drywall.xlsx'),
      buildRows(120),
    );
    await writeWorkbook(
      path.join(archiveDir, 'VV_PBK_archiv.xlsx'),
      buildRows(110),
    );

    const runner = new BidComparisonRunner();
    const result = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }, { name: 'PBK' }],
    });

    const fileNames = result.files.map((file) => file.fileName);
    expect(fileNames).toContain('VV_Drywall.xlsx');
    expect(fileNames).not.toContain('VV_PBK_archiv.xlsx');
  });
});
