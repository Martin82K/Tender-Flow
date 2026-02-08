import * as path from 'path';
import { FolderWatcherService } from './folderWatcher';
import { getBidComparisonRunner } from './bidComparisonRunner';
import type {
  BidComparisonAutoConfig,
  BidComparisonAutoScope,
  BidComparisonAutoStartResult,
  BidComparisonAutoStatus,
  BidComparisonDetectedFile,
  BidComparisonJobStatus,
  BidComparisonRole,
  BidComparisonSelectedFileInput,
  BidComparisonStartInput,
} from '../types';

const STORAGE_KEY = 'bidComparison:autoConfigs:v1';
const DEFAULT_DEBOUNCE_MS = 10_000;
const DEFAULT_FALLBACK_MINUTES = 15;
const JOB_POLL_INTERVAL_MS = 900;
const JOB_TIMEOUT_MS = 20 * 60 * 1000;

type RunTriggerReason = 'file_change' | 'fallback' | 'manual_update' | 'pending_rerun';

interface StorageLike {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

interface WatcherLike {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

type WatcherFactory = (
  folderPath: string,
  onChange: (eventType: string, filePath: string) => void,
) => WatcherLike;

type RunnerLike = {
  detectInputs: (args: {
    tenderFolderPath: string;
    suppliers: Array<{ name: string }>;
  }) => Promise<{
    tenderFolderPath: string;
    files: BidComparisonDetectedFile[];
    warnings: string[];
  }>;
  start: (input: BidComparisonStartInput) => { jobId: string };
  get: (jobId: string) => BidComparisonJobStatus | null;
};

interface AutoSession {
  key: string;
  config: Required<BidComparisonAutoConfig>;
  status: BidComparisonAutoStatus;
  watcher: WatcherLike | null;
  debounceTimer: NodeJS.Timeout | null;
  fallbackTimer: NodeJS.Timeout | null;
  running: boolean;
  pendingRerun: boolean;
  disposed: boolean;
}

const makeScopeKey = (scope: BidComparisonAutoScope): string =>
  `${scope.projectId}::${scope.categoryId}`;

const normalizeScope = (config: BidComparisonAutoConfig): BidComparisonAutoScope => ({
  projectId: config.projectId,
  categoryId: config.categoryId,
});

const toIsoNow = (): string => new Date().toISOString();

const isXlsxPath = (filePath: string): boolean => filePath.toLowerCase().endsWith('.xlsx');

const normalizeConfig = (config: BidComparisonAutoConfig): Required<BidComparisonAutoConfig> => ({
  ...config,
  tenderFolderPath: path.resolve(config.tenderFolderPath),
  suppliers: Array.isArray(config.suppliers) ? config.suppliers : [],
  selectedFiles: Array.isArray(config.selectedFiles) ? config.selectedFiles : [],
  outputBaseName: (config.outputBaseName || 'porovnani_nabidek').trim() || 'porovnani_nabidek',
  debounceMs: Number.isFinite(config.debounceMs)
    ? Math.max(1_000, Math.floor(config.debounceMs as number))
    : DEFAULT_DEBOUNCE_MS,
  fallbackIntervalMinutes: Number.isFinite(config.fallbackIntervalMinutes)
    ? Math.max(1, Math.floor(config.fallbackIntervalMinutes as number))
    : DEFAULT_FALLBACK_MINUTES,
});

const makeStatusFromConfig = (config: Required<BidComparisonAutoConfig>): BidComparisonAutoStatus => ({
  projectId: config.projectId,
  categoryId: config.categoryId,
  tenderFolderPath: config.tenderFolderPath,
  enabled: config.enabled,
  state: config.enabled ? 'watching' : 'inactive',
  debounceMs: config.debounceMs,
  fallbackIntervalMinutes: config.fallbackIntervalMinutes,
  outputBaseName: config.outputBaseName,
  pendingReason: 'none',
  lastRunAt: null,
  lastRunResult: null,
  lastJobId: null,
  lastError: null,
  unresolvedFiles: [],
  updatedAt: toIsoNow(),
});

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isGeneratedOutput = (filePath: string, outputBaseName: string): boolean => {
  const base = path.basename(filePath).toLowerCase();
  const key = outputBaseName.toLowerCase();
  return base.startsWith(`${key}_`) || base === `${key}.xlsx`;
};

const shouldReactToFileChange = (filePath: string, outputBaseName: string): boolean => {
  const base = path.basename(filePath);
  if (base.startsWith('~$')) return false;
  if (!isXlsxPath(filePath)) return false;
  if (isGeneratedOutput(filePath, outputBaseName)) return false;
  return true;
};

const mergeSelectedFiles = (
  detectedFiles: BidComparisonDetectedFile[],
  selectedFiles: BidComparisonSelectedFileInput[],
) => {
  const selectedMap = new Map<string, BidComparisonSelectedFileInput>();
  selectedFiles.forEach((item) => {
    selectedMap.set(path.resolve(item.path), item);
  });

  return detectedFiles.map((file) => {
    const resolvedPath = path.resolve(file.path);
    const selected = selectedMap.get(resolvedPath);
    const role: BidComparisonRole = selected?.role || file.suggestedRole;
    const supplierName =
      role === 'offer'
        ? (selected?.supplierName || file.suggestedSupplierName || null)
        : null;
    const roundCandidate = selected?.round ?? file.suggestedRound;
    const round = Number.isFinite(roundCandidate)
      ? Math.max(0, Math.floor(roundCandidate as number))
      : 0;

    return {
      ...file,
      role,
      supplierName,
      round,
    };
  });
};

const extractStartInput = (
  config: Required<BidComparisonAutoConfig>,
  files: Array<
    BidComparisonDetectedFile & {
      role: BidComparisonRole;
      supplierName: string | null;
      round: number;
    }
  >,
) => {
  const unresolvedFiles = files.filter((file) => {
    if (!file.analysis?.isValidTemplate) return false;
    if (file.role !== 'ignore') return false;
    if (isGeneratedOutput(file.path, config.outputBaseName)) return false;
    return true;
  });

  const selectedFiles = files
    .filter((file) => file.role !== 'ignore')
    .map((file): BidComparisonSelectedFileInput => ({
      path: file.path,
      role: file.role,
      supplierName: file.role === 'offer' ? file.supplierName : null,
      round: file.role === 'offer' ? file.round : undefined,
      mtimeMs: file.mtimeMs,
    }));

  const zadaniCount = selectedFiles.filter((file) => file.role === 'zadani').length;
  const offers = selectedFiles.filter((file) => file.role === 'offer');
  const offersMissingSupplier = offers.some((offer) => !(offer.supplierName || '').trim());

  const blockingReasons: string[] = [];
  if (zadaniCount !== 1) {
    blockingReasons.push('Musí být právě jeden soubor zadání.');
  }
  if (offers.length < 1) {
    blockingReasons.push('Musí být alespoň jedna nabídka dodavatele.');
  }
  if (offersMissingSupplier) {
    blockingReasons.push('Některé nabídky nemají přiřazeného dodavatele.');
  }
  if (unresolvedFiles.length > 0) {
    blockingReasons.push('Byly nalezeny nejednoznačné soubory, které vyžadují ruční mapování.');
  }

  if (blockingReasons.length > 0) {
    return {
      canRun: false as const,
      blockingReasons,
      unresolvedFiles: unresolvedFiles.map((file) => file.relativePath),
    };
  }

  const input: BidComparisonStartInput = {
    projectId: config.projectId,
    categoryId: config.categoryId,
    tenderFolderPath: config.tenderFolderPath,
    outputBaseName: config.outputBaseName,
    selectedFiles,
  };

  return {
    canRun: true as const,
    input,
    unresolvedFiles: [] as string[],
  };
};

export class BidComparisonAutoRunner {
  private readonly sessions = new Map<string, AutoSession>();

  constructor(
    private readonly storage: StorageLike,
    private readonly runner: RunnerLike = getBidComparisonRunner(),
    private readonly watcherFactory: WatcherFactory = (folderPath, onChange) =>
      new FolderWatcherService(folderPath, onChange),
  ) {}

  async restorePersistedSessions(): Promise<void> {
    const persisted = await this.loadPersistedMap();
    const enabledItems = Object.values(persisted).filter((item) => item.enabled);
    for (const config of enabledItems) {
      await this.autoStart(config);
    }
  }

  async autoStart(configInput: BidComparisonAutoConfig): Promise<BidComparisonAutoStartResult> {
    const config = normalizeConfig(configInput);
    const scope = normalizeScope(config);
    const key = makeScopeKey(scope);
    const persisted = await this.loadPersistedMap();
    persisted[key] = config;
    await this.savePersistedMap(persisted);

    const existing = this.sessions.get(key);
    if (existing) {
      const folderChanged =
        path.resolve(existing.config.tenderFolderPath) !== path.resolve(config.tenderFolderPath);
      existing.config = config;
      existing.status = {
        ...existing.status,
        enabled: true,
        tenderFolderPath: config.tenderFolderPath,
        debounceMs: config.debounceMs,
        fallbackIntervalMinutes: config.fallbackIntervalMinutes,
        outputBaseName: config.outputBaseName,
        updatedAt: toIsoNow(),
      };

      if (folderChanged) {
        await this.restartWatcher(existing);
      }
      this.startFallbackTimer(existing);
      this.enqueueRun(existing, 'manual_update', false);
      return { success: true, status: this.cloneStatus(existing.status) };
    }

    const status = makeStatusFromConfig(config);
    const session: AutoSession = {
      key,
      config,
      status,
      watcher: null,
      debounceTimer: null,
      fallbackTimer: null,
      running: false,
      pendingRerun: false,
      disposed: false,
    };
    this.sessions.set(key, session);

    await this.startWatcher(session);
    this.startFallbackTimer(session);
    this.enqueueRun(session, 'manual_update', false);

    return { success: true, status: this.cloneStatus(session.status) };
  }

  async autoStop(scope: BidComparisonAutoScope): Promise<{ success: boolean }> {
    const key = makeScopeKey(scope);
    const session = this.sessions.get(key);
    if (session) {
      await this.disposeSession(session, false);
      this.sessions.delete(key);
    }

    const persisted = await this.loadPersistedMap();
    const existing = persisted[key];
    if (existing) {
      persisted[key] = { ...existing, enabled: false };
      await this.savePersistedMap(persisted);
    }

    return { success: true };
  }

  async autoStatus(scope: BidComparisonAutoScope): Promise<BidComparisonAutoStatus | null> {
    const key = makeScopeKey(scope);
    const active = this.sessions.get(key);
    if (active) {
      return this.cloneStatus(active.status);
    }

    const persisted = await this.loadPersistedMap();
    const config = persisted[key];
    if (!config) return null;
    return this.cloneStatus(makeStatusFromConfig(config));
  }

  async autoList(): Promise<BidComparisonAutoStatus[]> {
    const persisted = await this.loadPersistedMap();
    const statusByKey = new Map<string, BidComparisonAutoStatus>();

    Object.entries(persisted).forEach(([key, config]) => {
      statusByKey.set(key, makeStatusFromConfig(config));
    });

    this.sessions.forEach((session) => {
      statusByKey.set(session.key, this.cloneStatus(session.status));
    });

    return [...statusByKey.values()].sort((a, b) =>
      `${a.projectId}-${a.categoryId}`.localeCompare(`${b.projectId}-${b.categoryId}`, 'cs'),
    );
  }

  private async startWatcher(session: AutoSession): Promise<void> {
    session.status.state = 'watching';
    session.status.updatedAt = toIsoNow();
    session.watcher = this.watcherFactory(
      session.config.tenderFolderPath,
      (_eventType, filePath) => {
        if (!shouldReactToFileChange(filePath, session.config.outputBaseName)) return;
        this.enqueueRun(session, 'file_change', true);
      },
    );
    await session.watcher.start();
  }

  private async restartWatcher(session: AutoSession): Promise<void> {
    if (session.watcher) {
      await session.watcher.stop();
      session.watcher = null;
    }
    await this.startWatcher(session);
  }

  private startFallbackTimer(session: AutoSession): void {
    if (session.fallbackTimer) {
      clearInterval(session.fallbackTimer);
      session.fallbackTimer = null;
    }

    const everyMs = session.config.fallbackIntervalMinutes * 60 * 1000;
    session.fallbackTimer = setInterval(() => {
      this.enqueueRun(session, 'fallback', false);
    }, everyMs);
  }

  private enqueueRun(
    session: AutoSession,
    reason: RunTriggerReason,
    useDebounce: boolean,
  ): void {
    if (session.disposed || !session.config.enabled) return;

    if (session.running) {
      session.pendingRerun = true;
      session.status.pendingReason = reason;
      session.status.updatedAt = toIsoNow();
      return;
    }

    if (useDebounce) {
      if (session.debounceTimer) {
        clearTimeout(session.debounceTimer);
      }
      session.status.pendingReason = 'debounce';
      session.status.updatedAt = toIsoNow();
      session.debounceTimer = setTimeout(() => {
        session.debounceTimer = null;
        void this.runNow(session, reason);
      }, session.config.debounceMs);
      return;
    }

    void this.runNow(session, reason);
  }

  private async runNow(session: AutoSession, reason: RunTriggerReason): Promise<void> {
    if (session.disposed || !session.config.enabled) return;
    if (session.running) {
      session.pendingRerun = true;
      session.status.pendingReason = reason;
      session.status.updatedAt = toIsoNow();
      return;
    }

    session.running = true;
    session.status.state = 'running';
    session.status.pendingReason = reason;
    session.status.lastError = null;
    session.status.unresolvedFiles = [];
    session.status.updatedAt = toIsoNow();

    try {
      const detection = await this.runner.detectInputs({
        tenderFolderPath: session.config.tenderFolderPath,
        suppliers: session.config.suppliers,
      });

      const merged = mergeSelectedFiles(detection.files, session.config.selectedFiles);
      const startData = extractStartInput(session.config, merged);

      if (!startData.canRun) {
        session.status.state = 'waiting_mapping';
        session.status.lastRunResult = 'blocked';
        session.status.lastError = startData.blockingReasons.join(' ');
        session.status.unresolvedFiles = startData.unresolvedFiles;
        session.status.pendingReason = 'unresolved_mapping';
        session.status.updatedAt = toIsoNow();
        return;
      }

      const { jobId } = this.runner.start(startData.input);
      session.status.lastJobId = jobId;
      session.status.updatedAt = toIsoNow();

      const terminal = await this.waitForTerminalJob(jobId);
      session.status.lastRunAt = toIsoNow();
      session.status.updatedAt = toIsoNow();
      session.status.pendingReason = 'none';
      session.status.unresolvedFiles = [];

      if (terminal.status === 'success') {
        session.status.state = 'watching';
        session.status.lastRunResult = 'success';
        session.status.lastError = null;
      } else {
        session.status.state = 'error';
        session.status.lastRunResult = 'error';
        session.status.lastError = terminal.error || 'Auto-recompare skončil bez úspěchu.';
      }
    } catch (error) {
      session.status.state = 'error';
      session.status.lastRunResult = 'error';
      session.status.lastError = error instanceof Error ? error.message : String(error);
      session.status.updatedAt = toIsoNow();
    } finally {
      session.running = false;

      if (session.disposed || !session.config.enabled) return;

      if (session.pendingRerun) {
        session.pendingRerun = false;
        this.enqueueRun(session, 'pending_rerun', true);
      } else if (session.status.state === 'running') {
        session.status.state = 'watching';
        session.status.pendingReason = 'none';
        session.status.updatedAt = toIsoNow();
      }
    }
  }

  private async waitForTerminalJob(jobId: string): Promise<BidComparisonJobStatus> {
    const deadline = Date.now() + JOB_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const status = this.runner.get(jobId);
      if (!status) {
        throw new Error(`Job ${jobId} nebyl nalezen.`);
      }
      if (status.status === 'success' || status.status === 'error' || status.status === 'cancelled') {
        return status;
      }
      await sleep(JOB_POLL_INTERVAL_MS);
    }

    throw new Error('Auto-recompare timeout při čekání na dokončení jobu.');
  }

  private async disposeSession(session: AutoSession, keepPersistedEnabled: boolean): Promise<void> {
    session.disposed = true;
    session.config.enabled = keepPersistedEnabled;

    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
      session.debounceTimer = null;
    }
    if (session.fallbackTimer) {
      clearInterval(session.fallbackTimer);
      session.fallbackTimer = null;
    }
    if (session.watcher) {
      await session.watcher.stop();
      session.watcher = null;
    }

    session.status.enabled = keepPersistedEnabled;
    session.status.state = keepPersistedEnabled ? 'watching' : 'inactive';
    session.status.pendingReason = 'none';
    session.status.updatedAt = toIsoNow();
  }

  private cloneStatus(status: BidComparisonAutoStatus): BidComparisonAutoStatus {
    return {
      ...status,
      unresolvedFiles: [...status.unresolvedFiles],
    };
  }

  private async loadPersistedMap(): Promise<Record<string, Required<BidComparisonAutoConfig>>> {
    const raw = await this.storage.get(STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, BidComparisonAutoConfig>;
      const output: Record<string, Required<BidComparisonAutoConfig>> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        output[key] = normalizeConfig(value);
      });
      return output;
    } catch {
      return {};
    }
  }

  private async savePersistedMap(
    map: Record<string, Required<BidComparisonAutoConfig>>,
  ): Promise<void> {
    await this.storage.set(STORAGE_KEY, JSON.stringify(map));
  }
}

let bidComparisonAutoRunner: BidComparisonAutoRunner | null = null;

export const getBidComparisonAutoRunner = (
  storage?: StorageLike,
): BidComparisonAutoRunner => {
  if (!bidComparisonAutoRunner) {
    if (!storage) {
      throw new Error('BidComparisonAutoRunner vyžaduje storage při první inicializaci.');
    }
    bidComparisonAutoRunner = new BidComparisonAutoRunner(storage);
  }
  return bidComparisonAutoRunner;
};
