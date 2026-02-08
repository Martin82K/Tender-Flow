/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { BidComparisonAutoRunner } from '../desktop/main/services/bidComparisonAutoRunner';
import type {
  BidComparisonAutoConfig,
  BidComparisonDetectedFile,
  BidComparisonJobStatus,
} from '../desktop/main/types';

class InMemoryStorage {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
}

class FakeRunner {
  public detectCalls = 0;
  public startCalls = 0;

  constructor(
    private readonly filesFactory: () => BidComparisonDetectedFile[],
  ) {}

  async detectInputs(): Promise<{
    tenderFolderPath: string;
    files: BidComparisonDetectedFile[];
    warnings: string[];
  }> {
    this.detectCalls += 1;
    return {
      tenderFolderPath: '/tmp/tender',
      files: this.filesFactory(),
      warnings: [],
    };
  }

  start(): { jobId: string } {
    this.startCalls += 1;
    return { jobId: `job-${this.startCalls}` };
  }

  get(jobId: string): BidComparisonJobStatus | null {
    return {
      id: jobId,
      projectId: 'p1',
      categoryId: 'c1',
      tenderFolderPath: '/tmp/tender',
      status: 'success',
      progressPercent: 100,
      step: 'done',
      logs: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      outputPath: null,
      outputLatestPath: null,
      stats: null,
      error: null,
      cancelRequested: false,
    };
  }
}

const makeDetectedFile = (
  args: Partial<BidComparisonDetectedFile> & Pick<BidComparisonDetectedFile, 'path' | 'fileName'>,
): BidComparisonDetectedFile => ({
  path: args.path,
  relativePath: args.relativePath ?? args.fileName,
  fileName: args.fileName,
  sizeBytes: args.sizeBytes ?? 100,
  mtimeMs: args.mtimeMs ?? Date.now(),
  suggestedRole: args.suggestedRole ?? 'ignore',
  suggestedSupplierName: args.suggestedSupplierName ?? null,
  suggestedRound: args.suggestedRound ?? 0,
  analysis: args.analysis ?? {
    headerRow: 3,
    kRows: 5,
    pricedKRows: 5,
    columnMap: { typ: 2, kod: 3, jcena: 7 },
    isValidTemplate: true,
  },
  analysisError: args.analysisError ?? null,
});

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2000,
): Promise<void> => {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timeout while waiting for condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
};

describe('BidComparisonAutoRunner', () => {
  it('spustí auto běh a uloží status success', async () => {
    const storage = new InMemoryStorage();
    const runner = new FakeRunner(() => [
      makeDetectedFile({
        path: '/tmp/tender/zadani.xlsx',
        fileName: 'zadani.xlsx',
        suggestedRole: 'zadani',
      }),
      makeDetectedFile({
        path: '/tmp/tender/offer.xlsx',
        fileName: 'offer.xlsx',
        suggestedRole: 'offer',
        suggestedSupplierName: 'Drywall',
      }),
    ]);

    const callbacks: Array<(eventType: string, filePath: string) => void> = [];
    const autoRunner = new BidComparisonAutoRunner(
      storage,
      runner as any,
      (_folderPath, onChange) => {
        callbacks.push(onChange);
        return {
          start: async () => {},
          stop: async () => {},
        };
      },
    );

    const config: BidComparisonAutoConfig = {
      projectId: 'p1',
      categoryId: 'c1',
      tenderFolderPath: '/tmp/tender',
      suppliers: [{ name: 'Drywall' }],
      selectedFiles: [],
      enabled: true,
      debounceMs: 120,
      fallbackIntervalMinutes: 15,
      outputBaseName: 'porovnani_nabidek',
    };

    await autoRunner.autoStart(config);

    await waitFor(async () => {
      const status = await autoRunner.autoStatus({ projectId: 'p1', categoryId: 'c1' });
      return status?.lastRunResult === 'success';
    });

    const status = await autoRunner.autoStatus({ projectId: 'p1', categoryId: 'c1' });
    expect(status?.state).toBe('watching');
    expect(status?.lastRunResult).toBe('success');
    expect(runner.startCalls).toBe(1);
    expect(callbacks.length).toBe(1);
  });

  it('zablokuje auto běh při nejednoznačném mapování', async () => {
    const storage = new InMemoryStorage();
    const runner = new FakeRunner(() => [
      makeDetectedFile({
        path: '/tmp/tender/unknown.xlsx',
        fileName: 'unknown.xlsx',
        suggestedRole: 'ignore',
      }),
    ]);

    const autoRunner = new BidComparisonAutoRunner(
      storage,
      runner as any,
      () => ({
        start: async () => {},
        stop: async () => {},
      }),
    );

    const config: BidComparisonAutoConfig = {
      projectId: 'p2',
      categoryId: 'c2',
      tenderFolderPath: '/tmp/tender',
      suppliers: [{ name: 'Drywall' }],
      selectedFiles: [],
      enabled: true,
      outputBaseName: 'porovnani_nabidek',
    };

    await autoRunner.autoStart(config);

    await waitFor(async () => {
      const status = await autoRunner.autoStatus({ projectId: 'p2', categoryId: 'c2' });
      return status?.lastRunResult === 'blocked';
    });

    const status = await autoRunner.autoStatus({ projectId: 'p2', categoryId: 'c2' });
    expect(status?.state).toBe('waiting_mapping');
    expect(status?.unresolvedFiles.length).toBeGreaterThan(0);
    expect(runner.startCalls).toBe(0);
  });

  it('debounce sloučí více file-change eventů do jednoho běhu', async () => {
    const storage = new InMemoryStorage();
    const runner = new FakeRunner(() => [
      makeDetectedFile({
        path: '/tmp/tender/zadani.xlsx',
        fileName: 'zadani.xlsx',
        suggestedRole: 'zadani',
      }),
      makeDetectedFile({
        path: '/tmp/tender/offer.xlsx',
        fileName: 'offer.xlsx',
        suggestedRole: 'offer',
        suggestedSupplierName: 'PBK',
      }),
    ]);

    let watcherCallback: ((eventType: string, filePath: string) => void) | null = null;
    const autoRunner = new BidComparisonAutoRunner(
      storage,
      runner as any,
      (_folderPath, onChange) => {
        watcherCallback = onChange;
        return {
          start: async () => {},
          stop: async () => {},
        };
      },
    );

    await autoRunner.autoStart({
      projectId: 'p3',
      categoryId: 'c3',
      tenderFolderPath: '/tmp/tender',
      suppliers: [{ name: 'PBK' }],
      selectedFiles: [],
      enabled: true,
      debounceMs: 120,
      outputBaseName: 'porovnani_nabidek',
    });

    await waitFor(() => runner.startCalls === 1);
    if (!watcherCallback) {
      throw new Error('Watcher callback was not initialized.');
    }

    watcherCallback('modified', '/tmp/tender/new-offer.xlsx');
    watcherCallback('modified', '/tmp/tender/new-offer.xlsx');
    watcherCallback('modified', '/tmp/tender/new-offer.xlsx');

    await waitFor(() => runner.startCalls === 2, 2500);
    expect(runner.startCalls).toBe(2);
  });
});
