import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackFeatureUsage } from '../../services/featureUsageService';
import type {
  BidComparisonAutoConfig,
  BidComparisonAutoStatus,
  BidComparisonDetectedFile,
  BidComparisonJobStatus,
  BidComparisonRole,
} from '../../desktop/main/types';

interface EditableDetectedFile extends BidComparisonDetectedFile {
  role: BidComparisonRole;
  supplierName: string | null;
  round: number;
}

interface BidComparisonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  categoryId: string;
  initialTenderFolderPath: string | null;
  supplierNames: string[];
}

const terminalStates = new Set(['success', 'error', 'cancelled']);
type BidComparisonPhase = 'source' | 'mapping' | 'run';

const normalizeSupplierList = (list: string[]): string[] =>
  Array.from(new Set(list.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'cs'),
  );

export const BidComparisonPanel: React.FC<BidComparisonPanelProps> = ({
  isOpen,
  onClose,
  projectId,
  categoryId,
  initialTenderFolderPath,
  supplierNames,
}) => {
  const [tenderFolderPath, setTenderFolderPath] = useState<string>(
    initialTenderFolderPath || '',
  );
  const [files, setFiles] = useState<EditableDetectedFile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BidComparisonJobStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [autoStatus, setAutoStatus] = useState<BidComparisonAutoStatus | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [uiPhase, setUiPhase] = useState<BidComparisonPhase>('source');

  const trackedSuccessJobIdRef = useRef<string | null>(null);
  const autoDetectedPathRef = useRef<string | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const folderStorageScopedKey = useMemo(
    () => `bid-comparison-folder:${projectId}:${categoryId}`,
    [projectId, categoryId],
  );
  const folderStorageProjectKey = useMemo(
    () => `bid-comparison-folder:${projectId}`,
    [projectId],
  );

  useEffect(() => {
    if (!isOpen) return;
    const storedPath =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(folderStorageScopedKey) ||
          window.localStorage.getItem(folderStorageProjectKey) ||
          ''
        : '';
    setTenderFolderPath((initialTenderFolderPath || storedPath || '').trim());
    setJobId(null);
    setJob(null);
    setDetectError(null);
    setWarnings([]);
    setFiles([]);
    setAutoError(null);
    setAutoStatus(null);
    setUiPhase('source');
    trackedSuccessJobIdRef.current = null;
    autoDetectedPathRef.current = null;
  }, [
    folderStorageProjectKey,
    folderStorageScopedKey,
    initialTenderFolderPath,
    isOpen,
  ]);

  const supplierOptions = useMemo(() => {
    const fromProps = normalizeSupplierList(supplierNames);
    const fromFiles = normalizeSupplierList(
      files
        .map((file) => file.supplierName || '')
        .filter(Boolean),
    );
    return normalizeSupplierList([...fromProps, ...fromFiles]);
  }, [files, supplierNames]);

  const canUseDesktopApi =
    typeof window !== 'undefined' &&
    !!window.electronAPI?.platform?.isDesktop &&
    !!window.electronAPI?.bidComparison;
  const autoEnabled = !!autoStatus?.enabled;

  const buildAutoConfig = useCallback(
    (enabled: boolean): BidComparisonAutoConfig => ({
      projectId,
      categoryId,
      tenderFolderPath: tenderFolderPath.trim(),
      suppliers: supplierOptions.map((name) => ({ name })),
      selectedFiles: files.map((file) => ({
        path: file.path,
        role: file.role,
        supplierName: file.role === 'offer' ? file.supplierName : null,
        round: file.role === 'offer' ? file.round : undefined,
        mtimeMs: file.mtimeMs,
      })),
      enabled,
      debounceMs: 10_000,
      fallbackIntervalMinutes: 15,
      outputBaseName: 'porovnani_nabidek',
    }),
    [categoryId, files, projectId, supplierOptions, tenderFolderPath],
  );

  const runDetection = useCallback(
    async (folderPathParam?: string) => {
      if (!canUseDesktopApi) {
        setDetectError('Porovnání nabídek je dostupné pouze v desktop aplikaci.');
        return;
      }

      const folderPath = (folderPathParam || tenderFolderPath || '').trim();
      if (!folderPath) {
        setDetectError('Zadejte nebo vyberte složku výběrového řízení.');
        return;
      }

      setIsDetecting(true);
      setDetectError(null);

      try {
        const result = await window.electronAPI.bidComparison.detectInputs({
          tenderFolderPath: folderPath,
          suppliers: supplierOptions.length
            ? supplierOptions.map((name) => ({ name }))
            : [],
        });

        setTenderFolderPath(result.tenderFolderPath);
        setWarnings(result.warnings || []);
        const mappedFiles = result.files.map((file) => ({
          ...file,
          role: file.suggestedRole,
          supplierName: file.suggestedSupplierName,
          round: Number.isFinite(file.suggestedRound) ? Math.max(0, file.suggestedRound) : 0,
        }));
        setFiles(mappedFiles);
        if (mappedFiles.length > 0) {
          setUiPhase('mapping');
        } else {
          setUiPhase('source');
        }
      } catch (error) {
        setDetectError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsDetecting(false);
      }
    },
    [canUseDesktopApi, supplierOptions, tenderFolderPath],
  );

  const refreshAutoStatus = useCallback(async () => {
    if (!canUseDesktopApi || !isOpen) return;
    try {
      const next = await window.electronAPI.bidComparison.autoStatus({
        projectId,
        categoryId,
      });
      setAutoStatus(next);
    } catch (error) {
      setAutoError(error instanceof Error ? error.message : String(error));
    }
  }, [canUseDesktopApi, categoryId, isOpen, projectId]);

  const syncAutoConfig = useCallback(
    async (enabled: boolean) => {
      if (!canUseDesktopApi) return;
      const folder = tenderFolderPath.trim();
      if (!folder) return;
      const result = await window.electronAPI.bidComparison.autoStart(buildAutoConfig(enabled));
      setAutoStatus(result.status);
    },
    [buildAutoConfig, canUseDesktopApi, tenderFolderPath],
  );

  useEffect(() => {
    if (!isOpen) return;
    const candidatePath = (initialTenderFolderPath || tenderFolderPath || '').trim();
    if (!candidatePath) return;
    if (files.length > 0) return;
    if (isDetecting) return;
    if (autoDetectedPathRef.current === candidatePath) return;

    autoDetectedPathRef.current = candidatePath;
    void runDetection(candidatePath);
  }, [
    files.length,
    initialTenderFolderPath,
    isDetecting,
    isOpen,
    runDetection,
    tenderFolderPath,
  ]);

  useEffect(() => {
    if (!isOpen || !canUseDesktopApi) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await window.electronAPI.bidComparison.autoStatus({
          projectId,
          categoryId,
        });
        if (cancelled) return;
        setAutoStatus(next);
      } catch (error) {
        if (cancelled) return;
        setAutoError(error instanceof Error ? error.message : String(error));
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canUseDesktopApi, categoryId, isOpen, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const normalized = tenderFolderPath.trim();
    if (normalized) {
      window.localStorage.setItem(folderStorageScopedKey, normalized);
      window.localStorage.setItem(folderStorageProjectKey, normalized);
    } else {
      window.localStorage.removeItem(folderStorageScopedKey);
    }
  }, [folderStorageProjectKey, folderStorageScopedKey, isOpen, tenderFolderPath]);

  useEffect(() => {
    if (!isOpen || !jobId || !canUseDesktopApi) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await window.electronAPI.bidComparison.get(jobId);
        if (cancelled || !next) return;
        setJob(next);

        if (next.status === 'success' && trackedSuccessJobIdRef.current !== next.id) {
          trackedSuccessJobIdRef.current = next.id;
          void trackFeatureUsage('bid_comparison', {
            suppliersCount: Object.keys(next.stats?.suppliers || {}).length,
            pocetPolozek: next.stats?.pocetPolozek || 0,
          });
        }
      } catch {
        // Polling musí být odolný, chybu zobrazíme jen v UI stavu jobu.
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 700);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canUseDesktopApi, isOpen, jobId]);

  useEffect(() => {
    if (!isOpen || !autoEnabled || !canUseDesktopApi) return;
    if (!tenderFolderPath.trim()) return;

    if (autoSyncTimerRef.current) {
      window.clearTimeout(autoSyncTimerRef.current);
    }

    autoSyncTimerRef.current = window.setTimeout(() => {
      void syncAutoConfig(true).catch((error) => {
        setAutoError(error instanceof Error ? error.message : String(error));
      });
    }, 800);

    return () => {
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [autoEnabled, canUseDesktopApi, files, isOpen, syncAutoConfig, tenderFolderPath]);

  useEffect(() => {
    if (files.length === 0 && uiPhase !== 'source') {
      setUiPhase('source');
    }
  }, [files.length, uiPhase]);

  const roleSummary = useMemo(() => {
    const zadaniCount = files.filter((file) => file.role === 'zadani').length;
    const offerCount = files.filter((file) => file.role === 'offer').length;
    return { zadaniCount, offerCount };
  }, [files]);

  const canStart = useMemo(() => {
    if (!files.length) return false;
    if (roleSummary.zadaniCount !== 1) return false;
    if (roleSummary.offerCount < 1) return false;

    return files
      .filter((file) => file.role === 'offer')
      .every((file) => !!(file.supplierName || '').trim());
  }, [files, roleSummary.offerCount, roleSummary.zadaniCount]);

  const startComparison = useCallback(async () => {
    if (!canUseDesktopApi || !canStart) return;

    setIsStarting(true);
    setDetectError(null);
    setUiPhase('run');

    try {
      const payload = {
        projectId,
        categoryId,
        tenderFolderPath,
        outputBaseName: 'porovnani_nabidek',
        selectedFiles: files.map((file) => ({
          path: file.path,
          role: file.role,
          supplierName: file.role === 'offer' ? file.supplierName : null,
          round: file.role === 'offer' ? file.round : undefined,
          mtimeMs: file.mtimeMs,
        })),
      };

      const result = await window.electronAPI.bidComparison.start(payload);
      setJobId(result.jobId);
      const initial = await window.electronAPI.bidComparison.get(result.jobId);
      setJob(initial);
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStarting(false);
    }
  }, [canStart, canUseDesktopApi, categoryId, files, projectId, tenderFolderPath]);

  const cancelJob = useCallback(async () => {
    if (!canUseDesktopApi || !jobId) return;
    await window.electronAPI.bidComparison.cancel(jobId);
  }, [canUseDesktopApi, jobId]);

  const pickFolder = useCallback(async () => {
    if (!canUseDesktopApi) return;
    setIsPickingFolder(true);
    try {
      const selected = await window.electronAPI.fs.selectFolder();
      if (!selected?.path) return;
      setTenderFolderPath(selected.path);
      await runDetection(selected.path);
    } finally {
      setIsPickingFolder(false);
    }
  }, [canUseDesktopApi, runDetection]);

  const openOutputFile = useCallback(async () => {
    if (!job?.outputLatestPath && !job?.outputPath) return;
    const target = job.outputLatestPath || job.outputPath;
    if (!target) return;
    await window.electronAPI?.fs.openFile(target);
  }, [job?.outputLatestPath, job?.outputPath]);

  const openTenderFolder = useCallback(async () => {
    if (!tenderFolderPath.trim()) return;
    await window.electronAPI?.fs.openInExplorer(tenderFolderPath);
  }, [tenderFolderPath]);

  const toggleAutoMode = useCallback(
    async (enabled: boolean) => {
      if (!canUseDesktopApi) return;
      setAutoError(null);
      setIsAutoSaving(true);

      try {
        if (enabled) {
          if (!tenderFolderPath.trim()) {
            setAutoError('Pro zapnutí auto režimu zadejte složku VŘ.');
            return;
          }
          await syncAutoConfig(true);
          return;
        }

        await window.electronAPI.bidComparison.autoStop({
          projectId,
          categoryId,
        });
        await refreshAutoStatus();
      } catch (error) {
        setAutoError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsAutoSaving(false);
      }
    },
    [
      canUseDesktopApi,
      categoryId,
      projectId,
      refreshAutoStatus,
      syncAutoConfig,
      tenderFolderPath,
    ],
  );

  if (!isOpen) return null;

  const jobIsRunning = !!job && !terminalStates.has(job.status);
  const canOpenMapping = files.length > 0;
  const canOpenRun = files.length > 0;

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-6xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Porovnání nabídek</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Asynchronní zpracování cenových nabídek (kola + varianty)
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (jobIsRunning) {
                setIsClosing(true);
                try {
                  await cancelJob();
                } finally {
                  setIsClosing(false);
                  onClose();
                }
                return;
              }
              onClose();
            }}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            disabled={isClosing}
          >
            Zavřít
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!canUseDesktopApi && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
              Tento modul je dostupný pouze v desktop aplikaci Tender Flow.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Složka VŘ</p>
            <div className="flex gap-2">
              <input
                value={tenderFolderPath}
                onChange={(event) => setTenderFolderPath(event.target.value)}
                placeholder="Cesta ke složce výběrového řízení"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void runDetection()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                disabled={isDetecting || !tenderFolderPath.trim()}
              >
                {isDetecting ? 'Načítám...' : 'Načíst'}
              </button>
              <button
                type="button"
                onClick={() => void pickFolder()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                disabled={isPickingFolder}
              >
                {isPickingFolder ? 'Výběr...' : 'Vybrat složku'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Auto-recompare
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Po změně souborů + pojistný běh každých 15 minut
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleAutoMode(!autoEnabled)}
                disabled={isAutoSaving}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                  autoEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isAutoSaving ? 'Ukládám...' : autoEnabled ? 'Vypnout auto' : 'Zapnout auto'}
              </button>
            </div>

            {autoStatus && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p>
                  Stav: <span className="font-semibold">{autoStatus.state}</span>
                </p>
                <p>
                  Poslední běh:{' '}
                  {autoStatus.lastRunAt
                    ? new Date(autoStatus.lastRunAt).toLocaleString('cs-CZ')
                    : 'zatím neproběhl'}
                </p>
                {autoStatus.pendingReason !== 'none' && (
                  <p>Čekání: {autoStatus.pendingReason}</p>
                )}
                {autoStatus.unresolvedFiles.length > 0 && (
                  <p>
                    Nevyřešené soubory: {autoStatus.unresolvedFiles.slice(0, 3).join(', ')}
                    {autoStatus.unresolvedFiles.length > 3 ? '…' : ''}
                  </p>
                )}
                {autoStatus.lastError && (
                  <p className="text-rose-600 dark:text-rose-400">{autoStatus.lastError}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setUiPhase('source')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  uiPhase === 'source'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                1. Zdroj
              </button>
              <button
                type="button"
                onClick={() => canOpenMapping && setUiPhase('mapping')}
                disabled={!canOpenMapping}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                  uiPhase === 'mapping'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                2. Mapování
              </button>
              <button
                type="button"
                onClick={() => canOpenRun && setUiPhase('run')}
                disabled={!canOpenRun}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                  uiPhase === 'run'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                3. Spuštění
              </button>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          {detectError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {detectError}
            </div>
          )}

          {autoError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {autoError}
            </div>
          )}

          {uiPhase === 'mapping' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Mapování souborů
            </div>

            {files.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                Nejsou načtené žádné soubory. Zadejte složku a spusťte detekci.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800/50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2">Soubor</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Dodavatel</th>
                      <th className="px-3 py-2">Kolo</th>
                      <th className="px-3 py-2">Analýza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => {
                      const isOffer = file.role === 'offer';
                      return (
                        <tr key={file.path} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{file.relativePath}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={file.role}
                              onChange={(event) => {
                                const nextRole = event.target.value as BidComparisonRole;
                                setFiles((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          role: nextRole,
                                          supplierName:
                                            nextRole === 'offer'
                                              ? entry.supplierName || supplierOptions[0] || null
                                              : null,
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                            >
                              <option value="ignore">Ignorovat</option>
                              <option value="zadani">Zadání</option>
                              <option value="offer">Nabídka</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={file.supplierName || ''}
                              onChange={(event) => {
                                setFiles((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          supplierName: event.target.value || null,
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 min-w-[220px]"
                              disabled={!isOffer}
                            >
                              <option value="">Vyber dodavatele</option>
                              {supplierOptions.map((supplier) => (
                                <option key={supplier} value={supplier}>
                                  {supplier}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={file.round}
                              onChange={(event) => {
                                const nextRound = Number(event.target.value);
                                setFiles((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          round: Number.isFinite(nextRound) ? Math.max(0, Math.floor(nextRound)) : 0,
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              disabled={!isOffer}
                              className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            {file.analysisError ? (
                              <span className="text-rose-600">{file.analysisError}</span>
                            ) : file.analysis ? (
                              <span>
                                K řádky: {file.analysis.kRows}, oceněné: {file.analysis.pricedKRows}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          )}

          {uiPhase === 'run' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void startComparison()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                disabled={!canStart || isStarting || jobIsRunning}
              >
                {isStarting ? 'Spouštím...' : 'Spustit porovnání'}
              </button>

              {jobIsRunning && (
                <button
                  type="button"
                  onClick={() => void cancelJob()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-500"
                >
                  Zrušit job
                </button>
              )}

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Zadání: {roleSummary.zadaniCount} | Nabídky: {roleSummary.offerCount}
              </span>
            </div>

            {job && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{job.step}</p>
                  <p className="text-slate-500 dark:text-slate-400">{Math.round(job.progressPercent)}%</p>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      job.status === 'error'
                        ? 'bg-rose-500'
                        : job.status === 'success'
                          ? 'bg-emerald-500'
                          : job.status === 'cancelled'
                            ? 'bg-amber-500'
                            : 'bg-primary'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, job.progressPercent))}%` }}
                  />
                </div>

                {job.error && (
                  <p className="text-sm text-rose-600 dark:text-rose-400">{job.error}</p>
                )}

                {(job.outputLatestPath || job.outputPath) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openOutputFile()}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Otevřít výstup
                    </button>
                    <button
                      type="button"
                      onClick={() => void openTenderFolder()}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Otevřít složku VŘ
                    </button>
                  </div>
                )}

                {job.stats && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>Položek v zadání: {job.stats.pocetPolozek}</p>
                    {Object.entries(job.stats.suppliers).map(([label, stats]) => (
                      <p key={label}>
                        {label}: {stats.sparovano}/{job.stats?.pocetPolozek} spárováno
                      </p>
                    ))}
                  </div>
                )}

                <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-950/40">
                  {job.logs.map((log, index) => (
                    <p key={`${log}-${index}`} className="text-xs text-slate-600 dark:text-slate-300">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
