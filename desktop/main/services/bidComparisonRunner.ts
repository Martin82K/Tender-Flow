import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  BidComparisonDetectionResult,
  BidComparisonDetectedFile,
  BidComparisonJobResult,
  BidComparisonJobStatus,
  BidComparisonSelectedFileInput,
  BidComparisonStartInput,
  BidComparisonStartResult,
  BidComparisonSupplierOption,
} from '../types';
import {
  analyzeWorkbookFile,
  buildComparisonWorkbook,
  type BidOfferInput,
  type DetectionAnalysis,
} from './bidComparisonEngine';

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron']);

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const shouldIgnoreDirectory = (dirName: string): boolean => {
  if (IGNORE_DIRS.has(dirName)) return true;
  const normalized = normalizeText(dirName);
  return normalized.includes('archiv');
};

const parseRound = (fileName: string): number => {
  const candidates = [
    /kolo[ _-]*(\d+)/i,
    /\bk[ _-]?(\d+)\b/i,
    /round[ _-]*(\d+)/i,
  ];

  for (const pattern of candidates) {
    const match = fileName.match(pattern);
    if (match && match[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }
  }

  return 0;
};

const inferSupplier = (
  relativePath: string,
  suppliers: BidComparisonSupplierOption[],
): BidComparisonSupplierOption | null => {
  if (!suppliers.length) return null;

  const normalizedPath = normalizeText(relativePath);
  let best: { supplier: BidComparisonSupplierOption; score: number } | null = null;

  for (const supplier of suppliers) {
    const base = normalizeText(supplier.name);
    if (!base) continue;

    let score = 0;
    if (normalizedPath.includes(base)) {
      score += base.length * 4;
    }

    const tokens = base.split(' ').filter(Boolean);
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (normalizedPath.includes(token)) score += token.length;
    }

    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { supplier, score };
    }
  }

  if (!best) return null;
  return best.supplier;
};

const toTimestamp = (date = new Date()): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
};

const collectExcelFiles = async (root: string): Promise<Array<{ absolutePath: string; relativePath: string; size: number; mtimeMs: number }>> => {
  const output: Array<{ absolutePath: string; relativePath: string; size: number; mtimeMs: number }> = [];

  const walk = async (currentPath: string): Promise<void> => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) continue;
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.xlsx')) continue;
      if (entry.name.startsWith('~$')) continue;

      const stat = await fs.stat(absolutePath);
      output.push({
        absolutePath,
        relativePath: path.relative(root, absolutePath),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  };

  await walk(root);
  output.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'cs'));
  return output;
};

export class BidComparisonRunner {
  private readonly jobs = new Map<string, BidComparisonJobStatus>();

  async detectInputs(args: {
    tenderFolderPath: string;
    suppliers: BidComparisonSupplierOption[];
  }): Promise<BidComparisonDetectionResult> {
    const resolvedRoot = path.resolve(args.tenderFolderPath);
    const files = await collectExcelFiles(resolvedRoot);

    const detected: BidComparisonDetectedFile[] = [];
    for (const file of files) {
      let analysisError: string | null = null;
      let analysis: DetectionAnalysis | null = null;

      try {
        analysis = await analyzeWorkbookFile(file.absolutePath);
      } catch (error) {
        analysisError = error instanceof Error ? error.message : String(error);
      }

      const inferredSupplier = inferSupplier(file.relativePath, args.suppliers);
      const suggestedRound = parseRound(path.basename(file.absolutePath));

      detected.push({
        path: file.absolutePath,
        relativePath: file.relativePath,
        fileName: path.basename(file.absolutePath),
        sizeBytes: file.size,
        mtimeMs: file.mtimeMs,
        suggestedRole: 'ignore',
        suggestedSupplierName: inferredSupplier?.name || null,
        suggestedRound,
        analysis,
        analysisError,
      });
    }

    const validTemplates = detected.filter((file) => file.analysis?.isValidTemplate);

    // Zadání: preferujeme soubor bez ocenění, s nejvyšším počtem K řádků.
    const zadaniCandidate = [...validTemplates].sort((a, b) => {
      const aPriced = a.analysis?.pricedKRows ?? Number.MAX_SAFE_INTEGER;
      const bPriced = b.analysis?.pricedKRows ?? Number.MAX_SAFE_INTEGER;
      if (aPriced !== bPriced) return aPriced - bPriced;

      const aK = a.analysis?.kRows ?? 0;
      const bK = b.analysis?.kRows ?? 0;
      if (aK !== bK) return bK - aK;

      return a.relativePath.localeCompare(b.relativePath, 'cs');
    })[0];

    if (zadaniCandidate) {
      zadaniCandidate.suggestedRole = 'zadani';
    }

    detected.forEach((file) => {
      if (file.suggestedRole === 'zadani') return;
      if (!file.analysis?.isValidTemplate) return;

      file.suggestedRole = 'offer';
      if (!file.suggestedSupplierName) {
        file.suggestedRole = 'ignore';
      }
    });

    const warnings: string[] = [];
    if (!zadaniCandidate) {
      warnings.push('Nebyl nalezen vhodný soubor zadání. Nastavte jej ručně.');
    }

    args.suppliers.forEach((supplier) => {
      const hasOffer = detected.some(
        (file) =>
          file.suggestedRole === 'offer' &&
          file.suggestedSupplierName === supplier.name,
      );
      if (!hasOffer) {
        warnings.push(`Dodavatel "${supplier.name}" nemá automaticky přiřazenou nabídku.`);
      }
    });

    return {
      tenderFolderPath: resolvedRoot,
      files: detected,
      warnings,
    };
  }

  start(input: BidComparisonStartInput): BidComparisonStartResult {
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: BidComparisonJobStatus = {
      id: jobId,
      projectId: input.projectId ?? null,
      categoryId: input.categoryId ?? null,
      tenderFolderPath: path.resolve(input.tenderFolderPath),
      status: 'queued',
      progressPercent: 0,
      step: 'Čeká ve frontě',
      logs: ['Job vytvořen.'],
      startedAt: now,
      finishedAt: null,
      outputPath: null,
      outputLatestPath: null,
      stats: null,
      error: null,
      cancelRequested: false,
    };

    this.jobs.set(jobId, job);

    setImmediate(() => {
      void this.run(jobId, input);
    });

    return { jobId };
  }

  get(jobId: string): BidComparisonJobStatus | null {
    const job = this.jobs.get(jobId);
    return job ? { ...job, logs: [...job.logs] } : null;
  }

  list(filter?: { projectId?: string; categoryId?: string }): BidComparisonJobStatus[] {
    const values = [...this.jobs.values()];
    const filtered = values.filter((job) => {
      if (filter?.projectId && job.projectId !== filter.projectId) return false;
      if (filter?.categoryId && job.categoryId !== filter.categoryId) return false;
      return true;
    });

    return filtered
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((job) => ({ ...job, logs: [...job.logs] }));
  }

  cancel(jobId: string): { success: boolean } {
    const job = this.jobs.get(jobId);
    if (!job) return { success: false };
    job.cancelRequested = true;
    job.logs.push('Požadováno zrušení jobu...');
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.step = 'Zrušeno';
      job.finishedAt = new Date().toISOString();
      job.progressPercent = 100;
    }
    return { success: true };
  }

  private async run(jobId: string, input: BidComparisonStartInput): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status === 'cancelled') return;

    const setProgress = (percent: number, step: string): void => {
      job.progressPercent = Math.max(job.progressPercent, Math.min(100, percent));
      job.step = step;
      job.logs.push(step);
      if (job.logs.length > 200) {
        job.logs = job.logs.slice(-200);
      }
    };

    const ensureNotCancelled = (): void => {
      if (job.cancelRequested) {
        throw new Error('Porovnání bylo zrušeno uživatelem.');
      }
    };

    try {
      job.status = 'running';
      setProgress(3, 'Validuji vstupní soubory...');
      ensureNotCancelled();

      const selected = input.selectedFiles.filter((file) => file.role !== 'ignore');
      const zadani = selected.filter((file) => file.role === 'zadani');
      const offersRaw = selected.filter((file) => file.role === 'offer');

      if (zadani.length !== 1) {
        throw new Error('Musí být vybrán právě jeden soubor zadání.');
      }

      if (!offersRaw.length) {
        throw new Error('Musí být vybrána alespoň jedna nabídka dodavatele.');
      }

      const offersByGroup = new Map<string, BidComparisonSelectedFileInput[]>();
      offersRaw.forEach((offer) => {
        if (!offer.supplierName) {
          throw new Error(`Soubor ${offer.path} nemá přiřazeného dodavatele.`);
        }
        const round = Number.isFinite(offer.round) ? Math.max(0, Math.floor(offer.round as number)) : 0;
        const key = `${offer.supplierName}__${round}`;
        const existing = offersByGroup.get(key) || [];
        existing.push({ ...offer, round });
        offersByGroup.set(key, existing);
      });

      const offerEntries: BidOfferInput[] = [];
      for (const [groupKey, groupFiles] of offersByGroup.entries()) {
        ensureNotCancelled();
        const sorted = [...groupFiles].sort((a, b) => {
          const aTime = Number(a.mtimeMs || 0);
          const bTime = Number(b.mtimeMs || 0);
          if (aTime !== bTime) return aTime - bTime;
          return a.path.localeCompare(b.path, 'cs');
        });

        const [supplierName, roundStr] = groupKey.split('__');
        const round = Number(roundStr || '0');

        sorted.forEach((entry, index) => {
          const variant = index + 1;
          offerEntries.push({
            supplierName,
            round,
            variant,
            displayLabel: `${supplierName} (K${round} v${variant})`,
            filePath: entry.path,
          });
        });
      }

      offerEntries.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        if (a.variant !== b.variant) return a.variant - b.variant;
        return a.supplierName.localeCompare(b.supplierName, 'cs');
      });

      setProgress(10, 'Spouštím porovnání nabídek...');
      const result = await buildComparisonWorkbook({
        zadaniPath: zadani[0].path,
        offers: offerEntries,
        onProgress: (percent, step) => setProgress(percent, step),
        isCancelled: () => job.cancelRequested === true,
      });

      ensureNotCancelled();

      const outputBase = (input.outputBaseName || 'porovnani_nabidek').trim() || 'porovnani_nabidek';
      const archiveFileName = `${outputBase}_${toTimestamp()}.xlsx`;
      const latestFileName = `${outputBase}_latest.xlsx`;
      const outputPath = path.join(job.tenderFolderPath, archiveFileName);
      const latestPath = path.join(job.tenderFolderPath, latestFileName);

      await fs.writeFile(outputPath, result.outputBuffer);
      await fs.writeFile(latestPath, result.outputBuffer);

      const stats: BidComparisonJobResult = {
        pocetPolozek: result.pocetPolozek,
        suppliers: result.suppliers,
      };

      job.status = 'success';
      job.progressPercent = 100;
      job.step = 'Porovnání dokončeno';
      job.finishedAt = new Date().toISOString();
      job.outputPath = outputPath;
      job.outputLatestPath = latestPath;
      job.stats = stats;
      job.logs.push(`Výstup uložen: ${outputPath}`);
      job.logs.push(`Aktuální verze: ${latestPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job.cancelRequested || message.toLowerCase().includes('zrušeno')) {
        job.status = 'cancelled';
        job.step = 'Zrušeno';
      } else {
        job.status = 'error';
        job.step = 'Chyba při porovnání';
      }
      job.error = message;
      job.finishedAt = new Date().toISOString();
      job.progressPercent = Math.max(job.progressPercent, 100);
      job.logs.push(message);
    }
  }
}

let bidComparisonRunner: BidComparisonRunner | null = null;

export const getBidComparisonRunner = (): BidComparisonRunner => {
  if (!bidComparisonRunner) {
    bidComparisonRunner = new BidComparisonRunner();
  }
  return bidComparisonRunner;
};
