/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises';
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
  vi.unstubAllGlobals();
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

const waitForTerminalJob = async (
  runner: BidComparisonRunner,
  jobId: string,
) => {
  let job = runner.get(jobId);
  for (let i = 0; i < 100; i += 1) {
    if (job && (job.status === 'error' || job.status === 'success' || job.status === 'cancelled')) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    job = runner.get(jobId);
  }
  throw new Error('Job nedoběhl v limitu.');
};

describe('BidComparisonRunner.detectInputs', () => {
  it('najde podporované nabídky i mimo XLSX a označí je k normalizaci', async () => {
    const tempDir = await createTempDir();
    const supplierDir = path.join(tempDir, 'Drywall');
    await mkdir(supplierDir, { recursive: true });
    await writeFile(path.join(supplierDir, 'cenova-nabidka.pdf'), Buffer.from('%PDF-1.7'));
    await writeFile(path.join(supplierDir, 'polozky.csv'), 'Popis;J.cena\nPoložka A;125\n', 'utf8');

    const result = await new BidComparisonRunner().detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    expect(result.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'cenova-nabidka.pdf', sourceFormat: 'pdf', requiresNormalization: true, suggestedRole: 'offer', suggestedSupplierName: 'Drywall' }),
      expect.objectContaining({ fileName: 'polozky.csv', sourceFormat: 'csv', requiresNormalization: true, suggestedRole: 'offer', suggestedSupplierName: 'Drywall' }),
    ]));
  });

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


describe('BidComparisonRunner.start', () => {
  it('pošle dokumentovou nabídku na jednotný Hermes endpoint a lokálně z ní sestaví porovnání', async () => {
    const tempDir = await createTempDir();
    const pdfPath = path.join(tempDir, 'nabidka.pdf');
    await writeFile(pdfPath, Buffer.from('%PDF-1.7'));
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://agent.kalmatech.cz/v1/tender-flow/analyze');
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
      return new Response(JSON.stringify({
        schemaVersion: 1,
        requestId: String((init.body as FormData).get('requestId')),
        referenceItems: [{ referenceItemId: 'R-1', description: 'Položka A', quantity: 2, unit: 'm2', sourceText: 'Položka A', uncertainty: null }],
        suppliers: [{ supplierId: 'offer_1', supplierName: 'Drywall', round: '1', localScore: null }],
        matrix: [{ referenceItemId: 'R-1', offers: [{ supplierId: 'offer_1', offerItemDescription: 'Položka A', quantity: 2, unitPrice: 125, totalPrice: 250, currency: 'CZK', matchStatus: 'matched', uncertainty: null }] }],
        findings: [], summary: 'Bez zásadních rizik.', risks: [], recommendedChecks: [],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const runner = new BidComparisonRunner();
    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles: [{ path: pdfPath, role: 'offer', supplierName: 'Drywall', round: 1 }],
      agent: { enabled: true, baseUrl: 'https://agent.kalmatech.cz', bearerToken: 'test-token' },
    });
    const job = await waitForTerminalJob(runner, jobId);
    expect(job.status).toBe('success');
    expect(job.stats?.matrix?.[0].offers['Drywall (K1 v1)']).toMatchObject({ jcena: 125, celkem: 250 });
    expect(job.stats?.agentRecommendation?.summary).toBe('Bez zásadních rizik.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('zpracuje CSV nabídku lokálně a porovná ji bez API tokenu', async () => {
    const tempDir = await createTempDir();
    const zadaniPath = path.join(tempDir, 'zadani.xlsx');
    const csvPath = path.join(tempDir, 'Drywall.csv');
    await writeWorkbook(zadaniPath, buildRows(''));
    await writeFile(csvPath, 'Kód;Popis;MJ;Množství;J.cena\nA-001;Položka A;m2;2;125\n', 'utf8');

    const runner = new BidComparisonRunner();
    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles: [
        { path: zadaniPath, role: 'zadani' },
        { path: csvPath, role: 'offer', supplierName: 'Drywall', round: 1 },
      ],
    });
    const job = await waitForTerminalJob(runner, jobId);

    expect(job.status).toBe('success');
    expect(job.stats?.normalizations).toEqual([
      expect.objectContaining({ supplierName: 'Drywall', sourceFormat: 'csv', extractor: 'local-csv', reviewCount: 0 }),
    ]);
    expect(job.stats?.matrix?.[0].offers['Drywall (K1 v1)']?.jcena).toBe(125);
    const output = new ExcelJS.Workbook();
    await output.xlsx.readFile(job.outputLatestPath as string);
    const scoreFormula = output.getWorksheet('Vyhodnocení')?.getCell('E9').value as ExcelJS.CellFormulaValue;
    expect(scoreFormula.formula).toContain('$B$6/100');
  });

  it('u ručně zvoleného dokumentového zadání vyžádá API token', async () => {
    const tempDir = await createTempDir();
    const pdfPath = path.join(tempDir, 'zadani.pdf');
    const offerPath = path.join(tempDir, 'offer.xlsx');
    await writeFile(pdfPath, Buffer.from('%PDF-1.7'));
    await writeWorkbook(offerPath, buildRows(100));

    const runner = new BidComparisonRunner();
    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles: [
        { path: pdfPath, role: 'zadani' },
        { path: offerPath, role: 'offer', supplierName: 'Drywall' },
      ],
    });
    const job = await waitForTerminalJob(runner, jobId);
    expect(job.status).toBe('error');
    expect(job.error).toContain('chybí bezpečně uložený API token');
  });

  it('při nedostupné mapované základní poptávce pokračuje porovnáním nabídek', async () => {
    const tempDir = await createTempDir();
    const pdfPath = path.join(tempDir, 'zakladni-poptavka.pdf');
    const offerPath = path.join(tempDir, 'offer.xlsx');
    await writeFile(pdfPath, Buffer.from('%PDF-1.7'));
    await writeWorkbook(offerPath, buildRows(100));
    const runner = new BidComparisonRunner();
    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles: [
        { path: pdfPath, role: 'zadani', referenceSource: 'mapped_budget_attachment' },
        { path: offerPath, role: 'offer', supplierName: 'Drywall' },
      ],
    });
    const job = await waitForTerminalJob(runner, jobId);
    expect(job.status).toBe('success');
    expect(job.stats?.sourceMode).toBe('offers_only');
    expect(job.logs.some((log) => log.includes('pokračuji bez ní'))).toBe(true);
  });

  it('použije mapovanou CSV poptávku bez cen jako referenční soupis', async () => {
    const tempDir = await createTempDir();
    const referencePath = path.join(tempDir, 'zakladni-poptavka.csv');
    const offerPath = path.join(tempDir, 'offer.xlsx');
    await writeFile(referencePath, 'Kód;Popis;MJ;Množství\nA-001;Položka A;m2;2\n', 'utf8');
    await writeWorkbook(offerPath, buildRows(125));
    const runner = new BidComparisonRunner();
    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles: [
        { path: referencePath, role: 'zadani', referenceSource: 'mapped_budget_attachment' },
        { path: offerPath, role: 'offer', supplierName: 'Drywall' },
      ],
    });
    const job = await waitForTerminalJob(runner, jobId);
    expect(job.status).toBe('success');
    expect(job.stats?.sourceMode).toBe('zadani');
    expect(job.stats?.matrix?.[0]).toMatchObject({ kod: 'A-001', mnozstvi: 2 });
    expect(job.stats?.normalizations).toEqual(expect.arrayContaining([
      expect.objectContaining({ purpose: 'reference', sourceFormat: 'csv', reviewCount: 0 }),
    ]));
  });

  it('vytvoří latest workbook a archivní kopii s novým názvem', async () => {
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
    const detected = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    const selectedFiles = detected.files
      .filter((file) => file.suggestedRole !== 'ignore')
      .map((file) => ({
        path: file.path,
        role: file.suggestedRole,
        supplierName: file.suggestedSupplierName,
        round: file.suggestedRound,
        mtimeMs: file.mtimeMs,
      }));

    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles,
    });

    const job = await waitForTerminalJob(runner, jobId);

    expect(job.status).toBe('success');
    expect(job.outputLatestPath).toBe(path.join(tempDir, 'porovnani-nabidek-latest.xlsx'));
    expect(job.outputWorkbookPath).toBe(job.outputLatestPath);
    expect(job.stats?.matrix).toHaveLength(1);
    await expect(access(path.join(tempDir, 'porovnani-nabidek-latest.xlsx'))).resolves.toBeUndefined();

    const files = await readdir(tempDir);
    expect(files.some((file) => /^porovnani-nabidek-\d{8}-\d{6}\.xlsx$/.test(file))).toBe(true);
  });

  it('vytvoří porovnání i bez souboru zadání pouze z nabídek', async () => {
    const tempDir = await createTempDir();
    await writeWorkbook(
      path.join(tempDir, 'VV_Drywall_kolo1.xlsx'),
      buildRows(125),
    );

    const runner = new BidComparisonRunner();
    const detected = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    expect(detected.warnings).toContain(
      'Nebyl nalezen vhodný soubor zadání. Porovnání bude možné spustit pouze z dodaných nabídek.',
    );

    const selectedFiles = detected.files
      .filter((file) => file.fileName.includes('Drywall'))
      .map((file) => ({
        path: file.path,
        role: 'offer' as const,
        supplierName: 'Drywall',
        round: file.suggestedRound,
        mtimeMs: file.mtimeMs,
      }));

    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles,
    });

    const job = await waitForTerminalJob(runner, jobId);

    expect(job.status).toBe('success');
    expect(job.stats?.sourceMode).toBe('offers_only');
    expect(job.stats?.matrix).toHaveLength(1);
    await expect(access(path.join(tempDir, 'porovnani-nabidek-latest.xlsx'))).resolves.toBeUndefined();
  });

  it('při chybě Hermes agenta dokončí workbook bez agentního listu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      headers: new Headers(),
      body: new Response(JSON.stringify({ error: 'unavailable' })).body,
      text: async () => JSON.stringify({ error: 'unavailable' }),
    })));

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
    const detected = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    const selectedFiles = detected.files
      .filter((file) => file.suggestedRole !== 'ignore')
      .map((file) => ({
        path: file.path,
        role: file.suggestedRole,
        supplierName: file.suggestedSupplierName,
        round: file.suggestedRound,
        mtimeMs: file.mtimeMs,
      }));

    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles,
      agent: {
        enabled: true,
        baseUrl: 'https://agent.kalmatech.cz',
        bearerToken: 'test-token',
        timeoutMs: 5000,
      },
    });

    const job = await waitForTerminalJob(runner, jobId);

    expect(job.status).toBe('success');
    expect(job.agentAnalysisStatus).toBe('error');
    expect(job.agentAnalysisError).toContain('HTTP 503');
    expect(job.stats?.agentRecommendation).toBeNull();
    await expect(access(path.join(tempDir, 'porovnani-nabidek-latest.xlsx'))).resolves.toBeUndefined();
  });

  it('odmítne outputBaseName s cestou mimo cílovou složku', async () => {
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
    const detected = await runner.detectInputs({
      tenderFolderPath: tempDir,
      suppliers: [{ name: 'Drywall' }],
    });

    const selectedFiles = detected.files
      .filter((file) => file.suggestedRole !== 'ignore')
      .map((file) => ({
        path: file.path,
        role: file.suggestedRole,
        supplierName: file.suggestedSupplierName,
        round: file.suggestedRound,
      }));

    const { jobId } = runner.start({
      tenderFolderPath: tempDir,
      selectedFiles,
      outputBaseName: '../pwned',
    });

    const job = await waitForTerminalJob(runner, jobId);

    expect(job).not.toBeNull();
    expect(job?.status).toBe('error');
    expect(job?.error).toContain('Neplatný název výstupu');

    await expect(access(path.join(tempDir, '..', 'pwned-latest.xlsx'))).rejects.toThrow();
  });
});
