/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { normalizeBidComparisonOffer } from '../desktop/main/services/bidComparisonNormalization';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bid-normalization-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('bidComparisonNormalization', () => {
  it('normalizuje CSV lokálně a zachová auditní JSON i reprodukovatelný XLSX', async () => {
    const root = await createTempDir();
    const sourcePath = path.join(root, 'Dodavatel A.csv');
    await writeFile(
      sourcePath,
      'PČ;Kód;Popis;MJ;Množství;J.cena;Celkem\n1;A-001;Montáž příčky;m2;10;1 234,50;12 345,00\n',
      'utf8',
    );

    const normalized = await normalizeBidComparisonOffer({
      rootPath: root,
      filePath: sourcePath,
      supplierName: 'Dodavatel A',
      baseUrl: 'https://agent.kalmatech.cz',
      secret: '',
      requestId: 'request-csv',
    });

    expect(normalized.result.extractor).toBe('local-csv');
    expect(normalized.result.items).toEqual([
      expect.objectContaining({ kod: 'A-001', popis: 'Montáž příčky', jcena: 1234.5, celkem: 12345, reviewRequired: false }),
    ]);
    expect(normalized.jsonPath).toContain(`${path.sep}porovnani-normalized${path.sep}`);
    const stored = JSON.parse(await readFile(normalized.jsonPath, 'utf8')) as { sourceSha256: string };
    expect(stored.sourceSha256).toMatch(/^[a-f0-9]{64}$/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(normalized.workbookPath);
    const sheet = workbook.getWorksheet('Normalizovaná nabídka');
    expect(sheet?.getCell('B2').value).toBe('K');
    expect(sheet?.getCell('G2').value).toBe(1234.5);
  });

  it('normalizuje referenční CSV poptávku i bez cen a ponechá položky aktivní pro párování', async () => {
    const root = await createTempDir();
    const sourcePath = path.join(root, 'zakladni-poptavka.csv');
    await writeFile(sourcePath, 'Kód;Popis;MJ;Množství\nA-001;Montáž příčky;m2;10\n', 'utf8');
    const normalized = await normalizeBidComparisonOffer({
      rootPath: root, filePath: sourcePath, supplierName: 'Základní poptávka',
      baseUrl: 'https://agent.kalmatech.cz', secret: '', requestId: 'reference-csv', purpose: 'reference',
    });
    expect(normalized.result).toMatchObject({ purpose: 'reference', reviewRequired: false });
    expect(normalized.result.items[0]).toMatchObject({ jcena: null, celkem: null, reviewRequired: false });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(normalized.workbookPath);
    expect(workbook.getWorksheet('Normalizovaná nabídka')?.getCell('B2').value).toBe('K');
  });

  it('vytváří stabilní zdrojově omezené PČ u CSV bez identifikátoru', async () => {
    const root = await createTempDir();
    const sourcePath = path.join(root, 'bez-id.csv');
    await writeFile(sourcePath, 'Popis;MJ;Celkem\nOdlišná položka;ks;500\n', 'utf8');
    const normalized = await normalizeBidComparisonOffer({
      rootPath: root, filePath: sourcePath, supplierName: 'Dodavatel',
      baseUrl: 'https://agent.kalmatech.cz', secret: '', requestId: 'csv-without-id',
    });
    expect(normalized.result.items[0].pc).toMatch(/^csv-[a-f0-9]{12}-1$/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(normalized.workbookPath);
    expect(workbook.getWorksheet('Normalizovaná nabídka')?.getCell('A2').value).toBe(normalized.result.items[0].pc);
  });

  it('odesílá PDF přes verzovaný HTTPS kontrakt a nejistý řádek označí ke kontrole', async () => {
    const root = await createTempDir();
    const sourcePath = path.join(root, 'nabidka.pdf');
    await writeFile(sourcePath, Buffer.from('%PDF-1.7 test'));
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
      expect((init.headers as Record<string, string>)['x-request-id']).toBe('request-pdf');
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      expect(form.get('schemaVersion')).toBe('1');
      expect(form.get('requestId')).toBe('request-pdf');
      expect(form.get('contentRole')).toBe('untrusted-business-data');
      expect(form.get('allowedTask')).toBe('price-item-extraction-only');
      expect(form.get('documentPurpose')).toBe('offer');
      expect(form.get('file')).toBeInstanceOf(Blob);
      return new Response(JSON.stringify({
        version: 1,
        items: [{ code: 'P-1', description: 'SDK stěna', unit: 'm2', quantity: 5, unitPrice: 800, confidence: 0.6 }],
        warnings: ['OCR vyžaduje kontrolu'],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const normalized = await normalizeBidComparisonOffer({
      rootPath: root,
      filePath: sourcePath,
      supplierName: 'Dodavatel B',
      baseUrl: 'https://agent.kalmatech.cz',
      secret: 'test-token',
      requestId: 'request-pdf',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://agent.kalmatech.cz/v1/tender-flow/offer-extraction',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(normalized.result.reviewRequired).toBe(true);
    expect(normalized.result.warnings).toContain('OCR vyžaduje kontrolu');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(normalized.workbookPath);
    expect(workbook.getWorksheet('Normalizovaná nabídka')?.getCell('B2').value).toBe('N');
  });

  it('odmítne neznámou verzi API a soubor mimo složku VŘ', async () => {
    const root = await createTempDir();
    const outside = await createTempDir();
    const outsidePath = path.join(outside, 'nabidka.pdf');
    await writeFile(outsidePath, Buffer.from('%PDF-1.7 test'));

    await expect(normalizeBidComparisonOffer({
      rootPath: root,
      filePath: outsidePath,
      supplierName: 'Dodavatel',
      baseUrl: 'https://agent.kalmatech.cz',
      secret: 'test-token',
      requestId: 'outside',
    })).rejects.toThrow('mimo složku VŘ');

    const insidePath = path.join(root, 'nabidka.pdf');
    await writeFile(insidePath, Buffer.from('%PDF-1.7 test'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: 2, items: [] }), { status: 200 })));
    await expect(normalizeBidComparisonOffer({
      rootPath: root,
      filePath: insidePath,
      supplierName: 'Dodavatel',
      baseUrl: 'https://agent.kalmatech.cz',
      secret: 'test-token',
      requestId: 'bad-version',
    })).rejects.toThrow('nepodporovanou verzi');
  });
});
