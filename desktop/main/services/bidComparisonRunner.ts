import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  BidComparisonAgentRecommendation,
  BidComparisonDetectionResult,
  BidComparisonDetectedFile,
  BidComparisonJobResult,
  BidComparisonJobStatus,
  BidComparisonNormalizationSummary,
  BidComparisonStoredResult,
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
import { requestBidComparisonAgentRecommendation } from './bidComparisonAgent';
import { analyzeBidComparisonWithHermes } from './bidComparisonHermes';
import { getBidComparisonSourceFormat, isSupportedBidComparisonSource, normalizeBidComparisonOffer } from './bidComparisonNormalization';
import { evaluateBidComparison } from './bidComparisonScoring';
import { SecureStorageService } from './secureStorage';
import {
  atomicWriteWorkspaceFile,
  fingerprintFile,
  loadBidComparisonConfig,
  saveBidComparisonConfig,
  saveBidComparisonResult,
} from './bidComparisonWorkspace';

const BID_COMPARISON_AGENT_SECRET_KEY = 'bid_comparison_agent_secret_v1';

const loadBidComparisonSecret = async (transientSecret?: string): Promise<string> => {
  if (transientSecret?.trim()) return transientSecret.trim();
  try {
    return await new SecureStorageService().get(BID_COMPARISON_AGENT_SECRET_KEY) || '';
  } catch {
    return '';
  }
};

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'porovnani-normalized']);

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
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const DEFAULT_OUTPUT_BASE_NAME = 'porovnani-nabidek';

const sanitizeOutputBaseName = (rawOutputBaseName?: string): string => {
  const trimmed = (rawOutputBaseName || '').trim();
  const candidate = trimmed || DEFAULT_OUTPUT_BASE_NAME;

  if (candidate !== path.basename(candidate) || /[\\/]/.test(candidate)) {
    throw new Error('Neplatný název výstupu. Použijte pouze název souboru bez cesty.');
  }

  return candidate;
};

const createProgressMapper = (
  setProgress: (percent: number, step: string) => void,
  start: number,
  end: number,
) => (percent: number, step: string): void => {
  const boundedPercent = Math.max(0, Math.min(100, percent));
  const mapped = start + Math.round((boundedPercent / 100) * (end - start));
  setProgress(mapped, step);
};

const ensurePathWithinRoot = (rootPath: string, targetPath: string): string => {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolvedTarget;
  }

  throw new Error('Neplatná cílová cesta výstupu.');
};

const collectOfferSourceFiles = async (root: string): Promise<Array<{ absolutePath: string; relativePath: string; size: number; mtimeMs: number }>> => {
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
      if (!isSupportedBidComparisonSource(entry.name)) continue;
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
    const files = await collectOfferSourceFiles(resolvedRoot);

    const detected: BidComparisonDetectedFile[] = [];
    for (const file of files) {
      let analysisError: string | null = null;
      let analysis: DetectionAnalysis | null = null;

      const sourceFormat = getBidComparisonSourceFormat(file.absolutePath);
      if (sourceFormat === 'xlsx') {
        try {
          analysis = await analyzeWorkbookFile(file.absolutePath);
        } catch (error) {
          analysisError = error instanceof Error ? error.message : String(error);
        }
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
        sourceFormat: sourceFormat || undefined,
        requiresNormalization: sourceFormat !== 'xlsx' || !analysis?.isValidTemplate,
      });
    }

    const validTemplates = detected.filter((file) => file.analysis?.isValidTemplate);
    const zadaniTemplates = validTemplates.filter((file) => (file.analysis?.pricedKRows ?? 0) === 0);

    // Zadání: preferujeme soubor bez ocenění, s nejvyšším počtem K řádků.
    const zadaniCandidate = [...zadaniTemplates].sort((a, b) => {
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
      if (file.analysis?.isValidTemplate || file.requiresNormalization) {
        file.suggestedRole = file.suggestedSupplierName ? 'offer' : 'ignore';
      }
    });

    const warnings: string[] = [];
    if (!zadaniCandidate) {
      warnings.push('Nebyl nalezen vhodný soubor zadání. Porovnání bude možné spustit pouze z dodaných nabídek.');
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
      outputWorkbookPath: null,
      agentAnalysisStatus: input.agent?.enabled ? 'pending' : 'disabled',
      agentAnalysisError: null,
      agentRecommendationWrittenAt: null,
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

      if (zadani.length > 1) {
        throw new Error('Může být vybrán nejvýše jeden soubor zadání.');
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
      const normalizations: BidComparisonNormalizationSummary[] = [];
      const normalizationBaseUrl = input.agent?.baseUrl || 'https://agent.kalmatech.cz';
      let hermesRecommendation: BidComparisonAgentRecommendation | null = null;
      const preparedOffers: Array<BidComparisonSelectedFileInput & { supplierName: string; round: number; variant: number; needsNormalization: boolean }> = [];
      for (const [groupKey, groupFiles] of offersByGroup.entries()) {
        const sorted = [...groupFiles].sort((a, b) => Number(a.mtimeMs || 0) - Number(b.mtimeMs || 0) || a.path.localeCompare(b.path, 'cs'));
        const [supplierName, roundStr] = groupKey.split('__');
        for (let index = 0; index < sorted.length; index += 1) {
          const entry = sorted[index];
          let needsNormalization = path.extname(entry.path).toLowerCase() !== '.xlsx';
          if (!needsNormalization) {
            try { needsNormalization = !(await analyzeWorkbookFile(entry.path)).isValidTemplate; }
            catch { needsNormalization = true; }
          }
          preparedOffers.push({ ...entry, supplierName, round: Number(roundStr || '0'), variant: index + 1, needsNormalization });
        }
      }

      let zadaniPath: string | undefined;
      let referenceNeedsNormalization = false;
      if (zadani.length === 1) {
        const reference = zadani[0];
        const isValidXlsx = path.extname(reference.path).toLowerCase() === '.xlsx' &&
          Boolean((await analyzeWorkbookFile(reference.path).catch(() => null))?.isValidTemplate);
        if (isValidXlsx) {
          zadaniPath = reference.path;
        } else {
          referenceNeedsNormalization = true;
        }
      }

      const needsHermesBatch = preparedOffers.some((offer) => offer.needsNormalization && getBidComparisonSourceFormat(offer.path) !== 'csv') ||
        (referenceNeedsNormalization && zadani[0] && getBidComparisonSourceFormat(zadani[0].path) !== 'csv');

      if (needsHermesBatch) {
        try {
          setProgress(5, 'Odesílám různorodé podklady Hermes agentovi k extrakci a párování...');
          const secret = await loadBidComparisonSecret(input.agent?.bearerToken);
          const batch = await analyzeBidComparisonWithHermes({
            rootPath: job.tenderFolderPath,
            reference: zadani[0],
            offers: preparedOffers,
            baseUrl: normalizationBaseUrl,
            secret,
            requestId: crypto.randomUUID(),
          });
          zadaniPath = batch.referenceWorkbookPath;
          hermesRecommendation = batch.recommendation;
          batch.offers.forEach((offer) => {
            const reviewCount = offer.result.items.filter((item) => item.reviewRequired).length;
            normalizations.push({ supplierName: offer.supplierName, purpose: 'offer', sourceFileName: offer.result.sourceFileName, sourceFormat: offer.result.sourceFormat, extractor: offer.result.extractor, itemCount: offer.result.items.length, reviewCount, warnings: offer.result.warnings });
            offerEntries.push({ supplierName: offer.supplierName, round: offer.round, variant: offer.variant, displayLabel: `${offer.supplierName} (K${offer.round} v${offer.variant})`, filePath: offer.workbookPath });
          });
          if (zadani[0] && batch.referenceWorkbookPath) {
            normalizations.push({ supplierName: 'Základní poptávka', purpose: 'reference', sourceFileName: path.relative(job.tenderFolderPath, zadani[0].path).replace(/\\/g, '/'), sourceFormat: getBidComparisonSourceFormat(zadani[0].path)!, extractor: 'remote-api', itemCount: 0, reviewCount: 0, warnings: [] });
          }
        } catch (error) {
          const canIgnoreMappedReference = Boolean(zadani[0]?.referenceSource === 'mapped_budget_attachment') && !preparedOffers.some((offer) => offer.needsNormalization && getBidComparisonSourceFormat(offer.path) !== 'csv');
          if (!canIgnoreMappedReference) throw error;
          job.logs.push(`Mapovanou základní poptávku se nepodařilo použít; pokračuji bez ní: ${error instanceof Error ? error.message : String(error)}`);
          zadaniPath = undefined;
          referenceNeedsNormalization = false;
        }
      }

      if (!needsHermesBatch || offerEntries.length === 0) {
        if (zadani.length === 1 && referenceNeedsNormalization) {
          const reference = zadani[0];
          try {
            setProgress(5, `Normalizuji referenční poptávku: ${path.basename(reference.path)}`);
            const sourceFormat = getBidComparisonSourceFormat(reference.path);
            if (!sourceFormat) throw new Error('Referenční poptávka má nepodporovaný formát.');
            const secret = sourceFormat === 'csv' ? '' : await loadBidComparisonSecret(input.agent?.bearerToken);
            const normalized = await normalizeBidComparisonOffer({
              rootPath: job.tenderFolderPath,
              filePath: reference.path,
              supplierName: 'Základní poptávka',
              baseUrl: normalizationBaseUrl,
              secret,
              requestId: crypto.randomUUID(),
              purpose: 'reference',
            });
            zadaniPath = normalized.workbookPath;
            const reviewCount = normalized.result.items.filter((item) => item.reviewRequired).length;
            normalizations.push({
              supplierName: 'Základní poptávka', purpose: 'reference',
              sourceFileName: normalized.result.sourceFileName, sourceFormat: normalized.result.sourceFormat,
              extractor: normalized.result.extractor, itemCount: normalized.result.items.length,
              reviewCount, warnings: normalized.result.warnings,
            });
          } catch (error) {
            if (reference.referenceSource !== 'mapped_budget_attachment') throw error;
            const message = error instanceof Error ? error.message : String(error);
            job.logs.push(`Mapovanou základní poptávku se nepodařilo použít; pokračuji bez ní: ${message}`);
            zadaniPath = undefined;
          }
        }
        for (const entry of preparedOffers) {
          ensureNotCancelled();
          const { supplierName, round, variant } = entry;
          let offerFilePath = entry.path;
          if (entry.needsNormalization) {
            setProgress(6, `Normalizuji nabídku: ${path.basename(entry.path)}`);
            const sourceFormat = getBidComparisonSourceFormat(entry.path);
            const normalizationSecret = sourceFormat === 'csv' ? '' : await loadBidComparisonSecret(input.agent?.bearerToken);
            const normalized = await normalizeBidComparisonOffer({
              rootPath: job.tenderFolderPath,
              filePath: entry.path,
              supplierName,
              baseUrl: normalizationBaseUrl,
              secret: normalizationSecret,
              requestId: crypto.randomUUID(),
            });
            offerFilePath = normalized.workbookPath;
            const reviewCount = normalized.result.items.filter((item) => item.reviewRequired).length;
            normalizations.push({
              supplierName,
              purpose: 'offer',
              sourceFileName: normalized.result.sourceFileName,
              sourceFormat: normalized.result.sourceFormat,
              extractor: normalized.result.extractor,
              itemCount: normalized.result.items.length,
              reviewCount,
              warnings: normalized.result.warnings,
            });
            normalized.result.warnings.forEach((warning) => job.logs.push(`Normalizace ${supplierName}: ${warning}`));
          }
          offerEntries.push({
            supplierName,
            round,
            variant,
            displayLabel: `${supplierName} (K${round} v${variant})`,
            filePath: offerFilePath,
          });
        }
      }

      offerEntries.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        if (a.variant !== b.variant) return a.variant - b.variant;
        return a.supplierName.localeCompare(b.supplierName, 'cs');
      });

      setProgress(10, 'Spouštím porovnání nabídek...');
      const wantsAgentAnalysis = input.agent?.enabled === true;
      const requestId = crypto.randomUUID();
      const evaluationConfig = input.evaluationConfig
        ? await saveBidComparisonConfig(job.tenderFolderPath, input.evaluationConfig)
        : await loadBidComparisonConfig(job.tenderFolderPath);
      const inputFingerprints = await Promise.all(selected.map((file) => fingerprintFile(job.tenderFolderPath, file.path)));
      const result = await buildComparisonWorkbook({
        zadaniPath,
        offers: offerEntries,
        onProgress: createProgressMapper(setProgress, 10, wantsAgentAnalysis ? 78 : 95),
        isCancelled: () => job.cancelRequested === true,
      });

      ensureNotCancelled();

      const evaluation = evaluateBidComparison(result.matrix, evaluationConfig);
      let agentRecommendation: BidComparisonAgentRecommendation | null = null;

      if (wantsAgentAnalysis) {
        if (hermesRecommendation) {
          agentRecommendation = hermesRecommendation;
          job.agentAnalysisStatus = 'success';
          job.agentAnalysisError = null;
          job.agentRecommendationWrittenAt = new Date().toISOString();
        } else {
        try {
          setProgress(82, 'Odesílám položkovou matici Hermes agentovi...');
          const secret = await loadBidComparisonSecret(input.agent?.bearerToken);
          agentRecommendation = await requestBidComparisonAgentRecommendation({
            config: { ...input.agent!, bearerToken: undefined },
            projectId: job.projectId,
            categoryId: job.categoryId,
            tenderFolderName: path.basename(job.tenderFolderPath),
            pocetPolozek: result.pocetPolozek,
            suppliers: result.suppliers,
            matrix: result.matrix,
            requestId,
            evaluation,
            criteria: evaluationConfig.suppliers,
          }, secret);
          ensureNotCancelled();

          job.agentAnalysisStatus = 'success';
          job.agentAnalysisError = null;
          job.agentRecommendationWrittenAt = new Date().toISOString();

        } catch (agentError) {
          const message = agentError instanceof Error ? agentError.message : String(agentError);
          job.agentAnalysisStatus = 'error';
          job.agentAnalysisError = message;
          job.agentRecommendationWrittenAt = null;
          job.logs.push(`Agentní analýza přeskočena: ${message}`);
        }
        }
      } else {
        job.agentAnalysisStatus = 'disabled';
        job.agentAnalysisError = null;
        job.agentRecommendationWrittenAt = null;
      }

      ensureNotCancelled();
      setProgress(90, 'Zapisuji vyhodnocení do workbooku...');
      const finalResult = await buildComparisonWorkbook({
        zadaniPath,
        offers: offerEntries,
        evaluation,
        requestId,
        inputFingerprints,
        agentRecommendation,
        onProgress: createProgressMapper(setProgress, 90, 98),
        isCancelled: () => job.cancelRequested === true,
      });

      const outputBase = sanitizeOutputBaseName(input.outputBaseName);
      const archiveFileName = `${outputBase}-${toTimestamp()}.xlsx`;
      const latestFileName = `${outputBase}-latest.xlsx`;
      await atomicWriteWorkspaceFile(job.tenderFolderPath, archiveFileName, finalResult.outputBuffer);
      await atomicWriteWorkspaceFile(job.tenderFolderPath, latestFileName, finalResult.outputBuffer);
      const outputPath = ensurePathWithinRoot(job.tenderFolderPath, path.join(job.tenderFolderPath, archiveFileName));
      const latestPath = ensurePathWithinRoot(job.tenderFolderPath, path.join(job.tenderFolderPath, latestFileName));

      const storedResult: BidComparisonStoredResult = {
        version: 1,
        generatedAt: new Date().toISOString(),
        requestId,
        algorithmVersion: evaluation.algorithmVersion,
        inputFingerprints,
        evaluation,
        agentRecommendation,
        normalizations,
      };
      await saveBidComparisonResult(job.tenderFolderPath, storedResult);

      const stats: BidComparisonJobResult = {
        pocetPolozek: finalResult.pocetPolozek,
        sourceMode: finalResult.sourceMode,
        matrix: finalResult.matrix,
        agentRecommendation,
        evaluation,
        requestId,
        inputFingerprints,
        normalizations,
        suppliers: finalResult.suppliers,
      };

      job.status = 'success';
      job.progressPercent = 100;
      job.step = 'Porovnání dokončeno';
      job.finishedAt = new Date().toISOString();
      job.outputPath = outputPath;
      job.outputLatestPath = latestPath;
      job.outputWorkbookPath = latestPath;
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
