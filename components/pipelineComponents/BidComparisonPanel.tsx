import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { openInExplorer } from '../../services/fileSystemService';
import platformAdapter from '../../services/platformAdapter';
import {
  BID_COMPARISON_AGENT_SETTINGS_KEY,
  parseBidComparisonAgentSettings,
  toRuntimeBidComparisonAgentConfig,
} from '../../shared/bidComparisonAgentSettings';
import { navigate } from '../../shared/routing/router';
import { useAccessibleDialog } from '../../shared/ui/useAccessibleDialog';
import type {
  BidComparisonAgentConfig,
  BidComparisonAutoConfig,
  BidComparisonAutoStatus,
  BidComparisonDetectedFile,
  BidComparisonFileConfig,
  BidComparisonJobState,
  BidComparisonJobStatus,
  BidComparisonRole,
  BidComparisonStoredResult,
  BidComparisonSupplierCriteria,
} from '../../shared/types/desktop';
import type { BudgetAttachment } from '../../types';

interface EditableDetectedFile extends BidComparisonDetectedFile {
  role: BidComparisonRole;
  supplierName: string | null;
  round: number;
  referenceSource?: 'mapped_budget_attachment';
}

interface BidComparisonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  categoryId: string;
  initialTenderFolderPath: string | null;
  supplierNames: string[];
  mappedBudgetAttachment?: BudgetAttachment | null;
}

const terminalStates: ReadonlySet<BidComparisonJobState> = new Set([
  'success',
  'error',
  'cancelled',
]);
const OUTPUT_BASE_NAME = 'porovnani-nabidek';
const WEIGHT_KEYS = ['price', 'completeness', 'commercialTerms', 'supplierHistory', 'priceRisk'] as const;
const DEFAULT_FILE_CONFIG: BidComparisonFileConfig = {
  version: 1,
  weights: { price: 45, completeness: 20, commercialTerms: 15, supplierHistory: 10, priceRisk: 10 },
  suppliers: {},
};
const EMPTY_CRITERIA: BidComparisonSupplierCriteria = {
  realizationDate: null,
  warrantyMonths: null,
  maturityDays: null,
  scopeConfirmed: null,
  supplierRating: null,
  note: '',
};

const normalizeSupplierList = (list: string[]): string[] =>
  Array.from(new Set(list.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'cs'),
  );

const formatFileSize = (sizeBytes: number): string => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 MB';
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
};

const formatQuantity = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('cs-CZ');
};

const getRoleLabel = (role: BidComparisonRole): string => {
  if (role === 'zadani') return 'Zadání';
  if (role === 'offer') return 'Nabídka';
  return 'Ignorovat';
};

const canBeReferenceFile = (file: BidComparisonDetectedFile): boolean =>
  file.analysis?.isValidTemplate === true || file.requiresNormalization === true;

const getStatusTone = (tone: 'ok' | 'warn' | 'idle'): string => {
  if (tone === 'ok') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (tone === 'warn') {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
};

const getTopLevelFolder = (relativePath: string): string => {
  const normalized = relativePath.replace(/\\/g, '/');
  const [firstPart] = normalized.split('/');
  return firstPart || 'Kořen složky';
};

const getBestRowTotal = (offers: Record<string, { celkem: number | null }>): number | null => {
  const totals = Object.values(offers)
    .map((offer) => offer.celkem)
    .filter((value): value is number => value != null && Number.isFinite(value));

  return totals.length ? Math.min(...totals) : null;
};

const getSupplierTotals = (
  rows: NonNullable<BidComparisonJobStatus['stats']>['matrix'],
  suppliers: string[],
): Record<string, number> => {
  const totals: Record<string, number> = Object.fromEntries(
    suppliers.map((supplier) => [supplier, 0]),
  );
  rows?.forEach((row) => {
    suppliers.forEach((supplier) => {
      const value = row.offers[supplier]?.celkem;
      if (value != null && Number.isFinite(value)) {
        totals[supplier] += value;
      }
    });
  });
  return totals;
};

export const BidComparisonPanel: React.FC<BidComparisonPanelProps> = ({
  isOpen,
  onClose,
  projectId,
  categoryId,
  initialTenderFolderPath,
  supplierNames,
  mappedBudgetAttachment,
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
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [agentConfig, setAgentConfig] = useState<BidComparisonAgentConfig>(
    parseBidComparisonAgentSettings(null),
  );
  const [fileConfig, setFileConfig] = useState<BidComparisonFileConfig>(DEFAULT_FILE_CONFIG);
  const [storedResult, setStoredResult] = useState<BidComparisonStoredResult | null>(null);
  const [hasAgentSecret, setHasAgentSecret] = useState(false);

  const autoDetectedPathRef = useRef<string | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
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
    setAgentConfig(parseBidComparisonAgentSettings(null));
    setFileConfig(DEFAULT_FILE_CONFIG);
    setStoredResult(null);
    setHasAgentSecret(false);
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

  const canUseDesktopApi = platformAdapter.bidComparison.isAvailable();
  const autoEnabled = !!autoStatus?.enabled;
  const runtimeAgentConfig = useMemo(
    () => toRuntimeBidComparisonAgentConfig(agentConfig),
    [agentConfig],
  );
  const agentIsRunnable = runtimeAgentConfig.enabled && hasAgentSecret;

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
        referenceSource: file.referenceSource,
      })),
      enabled,
      debounceMs: 10_000,
      fallbackIntervalMinutes: 15,
      outputBaseName: OUTPUT_BASE_NAME,
      agent: { ...runtimeAgentConfig, enabled: agentIsRunnable, bearerToken: undefined },
      evaluationConfig: fileConfig,
    }),
    [agentIsRunnable, categoryId, fileConfig, files, projectId, runtimeAgentConfig, supplierOptions, tenderFolderPath],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadAgentSettings = async () => {
      try {
        const raw = await platformAdapter.storage.get(BID_COMPARISON_AGENT_SETTINGS_KEY);
        if (!cancelled) {
          setAgentConfig(parseBidComparisonAgentSettings(raw));
        }
      } catch {
        if (!cancelled) {
          setAgentConfig(parseBidComparisonAgentSettings(null));
        }
      }
    };

    void loadAgentSettings();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
        const workspacePromise = typeof platformAdapter.bidComparison.loadWorkspace === 'function'
          ? platformAdapter.bidComparison.loadWorkspace(folderPath)
          : Promise.resolve({ config: DEFAULT_FILE_CONFIG, result: null, hasAgentSecret: false });
        const [result, workspace] = await Promise.all([
          platformAdapter.bidComparison.detectInputs({
            tenderFolderPath: folderPath,
            suppliers: supplierOptions.length ? supplierOptions.map((name) => ({ name })) : [],
          }),
          workspacePromise,
        ]);

        setTenderFolderPath(result.tenderFolderPath);
        setFileConfig(workspace.config);
        setStoredResult(workspace.result);
        setHasAgentSecret(workspace.hasAgentSecret);
        const attachmentRelativePath = mappedBudgetAttachment?.enabled
          ? mappedBudgetAttachment.relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
          : null;
        const hasMappedReference = Boolean(attachmentRelativePath && result.files.some(
          (file) => file.relativePath.replace(/\\/g, '/') === attachmentRelativePath,
        ));
        setWarnings([
          ...(result.warnings || []).filter((warning) => !warning.includes('Nebyl nalezen vhodný soubor zadání')),
          ...(attachmentRelativePath && !hasMappedReference
            ? [`Mapovaná základní poptávka „${mappedBudgetAttachment?.fileName || attachmentRelativePath}“ nebyla ve složce VŘ nalezena nebo nemá podporovaný formát.`]
            : []),
        ]);
        const mappedFiles = result.files.map((file) => {
          const isMappedReference = hasMappedReference && file.relativePath.replace(/\\/g, '/') === attachmentRelativePath;
          const displacedAutomaticReference = hasMappedReference && file.suggestedRole === 'zadani' && !isMappedReference;
          const role = isMappedReference
            ? 'zadani' as const
            : displacedAutomaticReference
              ? (file.suggestedSupplierName ? 'offer' as const : 'ignore' as const)
              : file.suggestedRole;
          return {
            ...file,
            role,
            supplierName: role === 'offer' ? file.suggestedSupplierName : null,
            round: Number.isFinite(file.suggestedRound) ? Math.max(0, file.suggestedRound) : 0,
            referenceSource: isMappedReference ? 'mapped_budget_attachment' as const : undefined,
          };
        });
        setFiles(mappedFiles);
      } catch (error) {
        setDetectError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsDetecting(false);
      }
    },
    [canUseDesktopApi, mappedBudgetAttachment, supplierOptions, tenderFolderPath],
  );

  const refreshAutoStatus = useCallback(async () => {
      if (!canUseDesktopApi || !isOpen) return;
    try {
      const next = await platformAdapter.bidComparison.autoStatus({
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
      const result = await platformAdapter.bidComparison.autoStart(buildAutoConfig(enabled));
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
        const next = await platformAdapter.bidComparison.autoStatus({
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
    let pollTimer: number | null = null;

    const scheduleNextPoll = () => {
      if (cancelled) return;
      pollTimer = window.setTimeout(() => {
        void poll();
      }, 700);
    };

    const poll = async () => {
      let shouldContinue = true;

      try {
        const next = await platformAdapter.bidComparison.get(jobId);
        if (cancelled || !next) return;
        setJob(next);
        shouldContinue = !terminalStates.has(next.status);

      } catch {
        // Polling musí být odolný, chybu zobrazíme jen v UI stavu jobu.
      } finally {
        if (shouldContinue) {
          scheduleNextPoll();
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }
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

  const roleSummary = useMemo(() => {
    const zadaniCount = files.filter((file) => file.role === 'zadani').length;
    const offerCount = files.filter((file) => file.role === 'offer').length;
    return { zadaniCount, offerCount };
  }, [files]);

  const offerFiles = useMemo(
    () => files.filter((file) => file.role === 'offer'),
    [files],
  );

  const blockingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!files.length) {
      reasons.push('Nejdřív načtěte složku VŘ.');
      return reasons;
    }
    if (roleSummary.zadaniCount > 1) {
      reasons.push('Může být vybrán nejvýše jeden soubor zadání.');
    }
    if (files.some((file) => file.role === 'zadani' && !canBeReferenceFile(file))) {
      reasons.push('Zadání musí být podporovaný dokument nebo validní XLSX.');
    }
    if (roleSummary.offerCount < 1) {
      reasons.push('Musí být alespoň jedna nabídka dodavatele.');
    }
    if (offerFiles.some((file) => !(file.supplierName || '').trim())) {
      reasons.push('Každá nabídka musí mít přiřazeného dodavatele.');
    }
    if (files.some((file) => file.role !== 'ignore' && file.requiresNormalization && file.sourceFormat !== 'csv' && file.referenceSource !== 'mapped_budget_attachment') && !hasAgentSecret) {
      reasons.push('Pro dokumenty a skeny je nutné uložit API token v nastavení porovnávání.');
    }
    return reasons;
  }, [files, hasAgentSecret, offerFiles, roleSummary.offerCount, roleSummary.zadaniCount]);

  const supplierReadiness = useMemo(
    () =>
      supplierOptions.map((supplier) => {
        const supplierOfferFiles = offerFiles.filter((file) => file.supplierName === supplier);
        return {
          supplier,
          offerCount: supplierOfferFiles.length,
          folders: Array.from(
            new Set(supplierOfferFiles.map((file) => getTopLevelFolder(file.relativePath))),
          ),
          latestRound: supplierOfferFiles.reduce((max, file) => Math.max(max, file.round), 0),
        };
      }),
    [offerFiles, supplierOptions],
  );

  const unresolvedFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          file.role === 'ignore' ||
          (file.role === 'offer' && !(file.supplierName || '').trim()) ||
          !!file.analysisError,
      ),
    [files],
  );

  const folderTreeItems = useMemo(() => {
    const zadaniFiles = files.filter((file) => file.role === 'zadani');
    const supplierItems = supplierReadiness.map((supplier) => ({
      label: supplier.supplier,
      helper:
        supplier.offerCount > 0
          ? `${supplier.offerCount} nabídka${supplier.offerCount === 1 ? '' : supplier.offerCount < 5 ? 'y' : 'ek'}`
          : 'chybí nabídka',
      tone: supplier.offerCount > 0 ? 'ok' as const : 'warn' as const,
      folders: supplier.folders,
    }));

    return [
      {
        label: 'Zadání / položkový rozpočet',
        helper:
          zadaniFiles.length === 1
            ? `${zadaniFiles[0].fileName} · zdroj množství`
            : zadaniFiles.length > 1
              ? `${zadaniFiles.length} soubory zadání`
              : 'nenalezeno, použije se alternativní porovnání',
        tone: zadaniFiles.length === 1 ? 'ok' as const : zadaniFiles.length > 1 ? 'warn' as const : 'idle' as const,
        folders: zadaniFiles.map((file) => getTopLevelFolder(file.relativePath)),
      },
      ...supplierItems,
      {
        label: 'Nepřiřazené',
        helper: unresolvedFiles.length ? `${unresolvedFiles.length} souborů ke kontrole` : 'čisté',
        tone: unresolvedFiles.length ? 'warn' as const : 'ok' as const,
        folders: unresolvedFiles.slice(0, 3).map((file) => file.fileName),
      },
    ];
  }, [files, supplierReadiness, unresolvedFiles]);

  const previewSupplierLabels = useMemo(() => {
    const fromStats = job?.stats?.suppliers ? Object.keys(job.stats.suppliers) : [];
    if (fromStats.length) return fromStats;
    return normalizeSupplierList(offerFiles.map((file) => file.supplierName || ''));
  }, [job?.stats?.suppliers, offerFiles]);

  const previewRows = useMemo(
    () => job?.stats?.matrix?.slice(0, 6) || [],
    [job?.stats?.matrix],
  );

  const visiblePreviewRows = useMemo(() => {
    if (!showOnlyDifferences) return previewRows;
    return previewRows.filter((row) => {
      const offers = previewSupplierLabels.map((supplier) => row.offers[supplier]);
      const pricedTotals = offers
        .map((offer) => offer?.celkem)
        .filter((value): value is number => value != null && Number.isFinite(value));
      const hasMissingOffer = offers.some((offer) => !offer?.matched || offer.celkem == null);
      const hasDifferentTotals = new Set(pricedTotals).size > 1;
      return hasMissingOffer || hasDifferentTotals;
    });
  }, [previewRows, previewSupplierLabels, showOnlyDifferences]);

  const agentStatusText =
    job?.agentAnalysisStatus === 'success'
      ? 'Agent hotovo'
      : job?.agentAnalysisStatus === 'error'
        ? 'Agent chyba'
        : job?.agentAnalysisStatus === 'pending'
          ? 'Agent běží'
          : agentIsRunnable
            ? 'Agent připraven'
            : 'Agent vypnutý';

  const supplierTotals = useMemo(
    () => getSupplierTotals(job?.stats?.matrix || [], previewSupplierLabels),
    [job?.stats?.matrix, previewSupplierLabels],
  );

  const lowestSupplierTotal = useMemo(() => {
    const entries = Object.entries(supplierTotals).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && entry[1] > 0,
    );
    if (!entries.length) return null;
    return entries.reduce(
      (best, current) => (current[1] < best[1] ? current : best),
      entries[0],
    );
  }, [supplierTotals]);

  const outputModeLabel =
    roleSummary.zadaniCount === 0 || job?.stats?.sourceMode === 'offers_only'
      ? 'Alternativní ocenění'
      : 'Rozpočet + nabídky';

  const inputHealthItems = useMemo(
    () => [
      {
        label: roleSummary.zadaniCount === 0 ? 'Rozpočet chybí' : 'Rozpočet OK',
        helper: roleSummary.zadaniCount === 0 ? 'alternativní režim' : 'zdroj množství',
        tone: roleSummary.zadaniCount === 0 ? 'warn' as const : 'ok' as const,
      },
      {
        label: roleSummary.zadaniCount > 0 ? 'Množství načteno' : 'Bez množství zadání',
        helper: roleSummary.zadaniCount > 0 ? 'výpočet celkem aktivní' : 'porovnání z nabídek',
        tone: roleSummary.zadaniCount > 0 ? 'ok' as const : 'idle' as const,
      },
      {
        label: `${roleSummary.offerCount} nabíd${roleSummary.offerCount === 1 ? 'ka' : roleSummary.offerCount < 5 ? 'ky' : 'ek'}`,
        helper: 'přiřazené nabídky',
        tone: roleSummary.offerCount > 0 ? 'ok' as const : 'warn' as const,
      },
      {
        label: `${unresolvedFiles.length} ke kontrole`,
        helper: unresolvedFiles.length ? 'vyžaduje zásah' : 'bez ručních zásahů',
        tone: unresolvedFiles.length ? 'warn' as const : 'ok' as const,
      },
      {
        label: agentStatusText,
        helper: agentIsRunnable ? 'doporučení dostupné' : 'volitelně',
        tone: agentIsRunnable ? 'ok' as const : 'idle' as const,
      },
    ],
    [agentIsRunnable, agentStatusText, roleSummary.offerCount, roleSummary.zadaniCount, unresolvedFiles.length],
  );

  const canStart = useMemo(() => {
    return blockingReasons.length === 0;
  }, [blockingReasons]);

  const startComparison = useCallback(async () => {
    if (!canUseDesktopApi || !canStart) return;

    setIsStarting(true);
    setDetectError(null);

    try {
      const payload = {
        projectId,
        categoryId,
        tenderFolderPath,
        outputBaseName: OUTPUT_BASE_NAME,
        agent: { ...runtimeAgentConfig, enabled: agentIsRunnable, bearerToken: undefined },
        evaluationConfig: fileConfig,
        selectedFiles: files.map((file) => ({
          path: file.path,
          role: file.role,
          supplierName: file.role === 'offer' ? file.supplierName : null,
          round: file.role === 'offer' ? file.round : undefined,
          mtimeMs: file.mtimeMs,
          referenceSource: file.referenceSource,
        })),
      };

      if (typeof platformAdapter.bidComparison.saveConfig === 'function') {
        await platformAdapter.bidComparison.saveConfig(tenderFolderPath, fileConfig);
      }
      const result = await platformAdapter.bidComparison.start(payload);
      setJobId(result.jobId);
      const initial = await platformAdapter.bidComparison.get(result.jobId);
      setJob(initial);
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStarting(false);
    }
  }, [agentIsRunnable, canStart, canUseDesktopApi, categoryId, fileConfig, files, projectId, runtimeAgentConfig, tenderFolderPath]);

  const cancelJob = useCallback(async () => {
    if (!canUseDesktopApi || !jobId) return;
    await platformAdapter.bidComparison.cancel(jobId);
  }, [canUseDesktopApi, jobId]);

  const pickFolder = useCallback(async () => {
    if (!canUseDesktopApi) return;
    setIsPickingFolder(true);
    try {
      const selected = await platformAdapter.fs.selectFolder();
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
    const result = await platformAdapter.fs.showItemInFolder(target);
    if (!result.success) {
      setDetectError(result.error || 'Výstupní soubor se nepodařilo zobrazit ve složce.');
    }
  }, [job?.outputLatestPath, job?.outputPath]);

  const openTenderFolder = useCallback(async () => {
    if (!tenderFolderPath.trim()) return;
    await openInExplorer(tenderFolderPath);
  }, [tenderFolderPath]);

  const openAgentSettings = useCallback(() => {
    onClose();
    navigate('/app/settings?tab=admin&subTab=bidComparison');
  }, [onClose]);

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
          if (blockingReasons.length > 0) {
            setAutoError(blockingReasons.join(' '));
            return;
          }
          await syncAutoConfig(true);
          return;
        }

        await platformAdapter.bidComparison.autoStop({
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
      blockingReasons,
      categoryId,
      projectId,
      refreshAutoStatus,
      syncAutoConfig,
      tenderFolderPath,
    ],
  );

  const jobIsRunning = !!job && !terminalStates.has(job.status);
  const visibleEvaluation = job?.stats?.evaluation || storedResult?.evaluation || null;
  const weightTotal = WEIGHT_KEYS.reduce((sum, key) => sum + fileConfig.weights[key], 0);
  const updateSupplierCriteria = useCallback((supplierName: string, patch: Partial<BidComparisonSupplierCriteria>) => {
    setFileConfig((current) => ({
      ...current,
      suppliers: {
        ...current.suppliers,
        [supplierName]: { ...(current.suppliers[supplierName] || EMPTY_CRITERIA), ...patch },
      },
    }));
  }, []);
  const handleRequestClose = useCallback(async () => {
    if (isClosing) return;

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
  }, [cancelJob, isClosing, jobIsRunning, onClose]);

  useAccessibleDialog({
    isOpen,
    onClose: () => {
      void handleRequestClose();
    },
    containerRef: dialogRef,
  });

  if (!isOpen) return null;

  return (
    <div data-help-id="pipeline-bid-comparison-modal" className="tf-modal-overlay fixed inset-0 z-[10001] bg-slate-100 dark:bg-slate-950 overflow-hidden">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        tabIndex={-1}
        className="tf-modal-panel tf-pipeline-modal-panel flex h-screen w-screen flex-col bg-white dark:bg-slate-900"
      >
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id={dialogTitleId} className="text-lg font-bold text-slate-900 dark:text-white">Porovnání nabídek</h2>
            <p id={dialogDescriptionId} className="text-xs text-slate-500 dark:text-slate-400">
              Zkontrolujte podklady, spusťte porovnání a otevřete hotový Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleRequestClose();
            }}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            disabled={isClosing}
          >
            Zavřít
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 bg-slate-50/80 p-4 dark:bg-slate-950/40">
          {!canUseDesktopApi && (
            <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
              Tento modul je dostupný pouze v desktop aplikaci Tender Flow.
            </div>
          )}

          <section className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
            <ol className="grid gap-2 sm:grid-cols-3" aria-label="Postup porovnání nabídek">
              {[
                { number: 1, label: 'Podklady', helper: files.length ? `${files.length} souborů načteno` : 'Vyberte složku VŘ', active: files.length > 0 },
                { number: 2, label: 'Kontrola', helper: blockingReasons.length ? `${blockingReasons.length} věcí k vyřešení` : 'Připraveno ke spuštění', active: files.length > 0 && blockingReasons.length === 0 },
                { number: 3, label: 'Výsledek', helper: job?.status === 'success' ? 'Excel je připravený' : jobIsRunning ? 'Porovnání probíhá' : 'Vznikne po spuštění', active: job?.status === 'success' },
              ].map((step) => (
                <li key={step.number} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${step.active ? 'border-primary/30 bg-primary/5' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{step.number}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{step.label}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{step.helper}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="flex-1 space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Složka výběrového řízení</span>
                <input
                  value={tenderFolderPath}
                  onChange={(event) => setTenderFolderPath(event.target.value)}
                  placeholder="Cesta ke složce výběrového řízení"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stav podkladů</p>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{outputModeLabel}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {inputHealthItems.map((item) => (
                  <div key={item.label} className={`rounded-lg border px-3 py-2 text-xs ${getStatusTone(item.tone)}`}>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-0.5 opacity-80">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {(warnings.length > 0 || detectError || autoError) && (
            <div className="shrink-0 space-y-2">
              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}

              {detectError && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {detectError}
                </div>
              )}

              {autoError && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {autoError}
                </div>
              )}
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <aside className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Vstupy</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Rozpočet, dodavatelé a soubory ke kontrole.</p>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
                {folderTreeItems.map((item) => (
                  <div key={item.label} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusTone(item.tone)}`}>
                        {item.tone === 'ok' ? 'OK' : item.tone === 'warn' ? 'Kontrola' : 'Volitelné'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.helper}</p>
                    {item.folders.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.folders.slice(0, 2).map((folder) => (
                          <p key={folder} className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {folder}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="shrink-0 flex flex-col gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cenová matice</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Výpočet: množství z rozpočtu × jednotková cena dodavatele.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                    nejnižší
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                    chybí / neoceněno
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOnlyDifferences((current) => !current)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-pressed={showOnlyDifferences}
                  >
                    {showOnlyDifferences ? 'Zobrazit vše' : 'Zobrazit pouze rozdíly'}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                    <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2">Kód</th>
                      <th className="px-3 py-2">Popis</th>
                      <th className="px-3 py-2">MJ</th>
                      <th className="px-3 py-2 text-right">Množství</th>
                      <th className="px-3 py-2 text-right">JC zadání</th>
                      <th className="px-3 py-2 text-right">Celkem zadání</th>
                      {previewSupplierLabels.map((supplier) => (
                        <th key={supplier} className="px-3 py-2 text-center" colSpan={2}>
                          {supplier}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-t border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase text-slate-400">
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      {previewSupplierLabels.map((supplier) => (
                        <React.Fragment key={`${supplier}-subhead`}>
                          <th className="px-3 py-1 text-right">JC</th>
                          <th className="px-3 py-1 text-right">Celkem</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreviewRows.length > 0 ? (
                      <>
                        {visiblePreviewRows.map((row) => {
                          const bestTotal = getBestRowTotal(row.offers);
                          return (
                            <tr key={row.radek} className="border-t border-slate-200 dark:border-slate-700">
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.kod || row.pc || '-'}</td>
                              <td className="px-3 py-2 max-w-[300px] truncate text-slate-800 dark:text-slate-100">{row.popis || '-'}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.mj || '-'}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatQuantity(row.mnozstvi)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-400">-</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-400">-</td>
                              {previewSupplierLabels.map((supplier) => {
                                const offer = row.offers[supplier];
                                const isBest = offer?.matched && offer.celkem != null && offer.celkem === bestTotal;
                                const priceCellClass = !offer?.matched
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                  : isBest
                                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                                    : 'text-slate-800 dark:text-slate-100';

                                return (
                                  <React.Fragment key={`${row.radek}-${supplier}`}>
                                    <td className={`px-3 py-2 text-right tabular-nums ${priceCellClass}`}>
                                      {formatCurrency(offer?.jcena)}
                                    </td>
                                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${priceCellClass}`}>
                                      <span>{formatCurrency(offer?.celkem)}</span>
                                      {isBest && (
                                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                                          nejnižší
                                        </span>
                                      )}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          );
                        })}
                        <tr className="border-t border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/50">
                          <td className="px-3 py-2" colSpan={4}>Celkem v náhledu</td>
                          <td className="px-3 py-2 text-right text-slate-400">-</td>
                          <td className="px-3 py-2 text-right text-slate-400">-</td>
                          {previewSupplierLabels.map((supplier) => (
                            <React.Fragment key={`${supplier}-total`}>
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {formatCurrency(supplierTotals[supplier])}
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td className="px-4 py-10 text-sm text-slate-500 dark:text-slate-400" colSpan={6 + previewSupplierLabels.length * 2}>
                          {previewSupplierLabels.length
                            ? showOnlyDifferences
                              ? 'V aktuálním náhledu nejsou žádné rozdíly ani chybějící ceny.'
                              : 'Náhled položek se zobrazí po spuštění porovnání.'
                            : 'Po načtení nabídek se zde připraví matice rozpočtu a dodavatelských cen.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="min-h-0 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
              <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Výsledek a další krok</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Připravenost, rizika a otevření hotového Excelu.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-500 dark:text-slate-400">Zadání</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{roleSummary.zadaniCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-500 dark:text-slate-400">Nabídky</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{roleSummary.offerCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-500 dark:text-slate-400">Dodavatelé</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {supplierReadiness.filter((supplier) => supplier.offerCount > 0).length}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-500 dark:text-slate-400">Ke kontrole</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{unresolvedFiles.length}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {lowestSupplierTotal ? (
                  <div className={`rounded-lg border px-3 py-2 ${getStatusTone('ok')}`}>
                    <p className="font-semibold">Nejnižší celkem</p>
                    <p>{lowestSupplierTotal[0]} · {formatCurrency(lowestSupplierTotal[1])}</p>
                  </div>
                ) : (
                  <div className={`rounded-lg border px-3 py-2 ${getStatusTone('idle')}`}>
                    <p className="font-semibold">Cenové doporučení</p>
                    <p>Zobrazí se po vytvoření matice.</p>
                  </div>
                )}
                {(job?.stats?.agentRecommendation || storedResult?.agentRecommendation)?.summary && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                    <p className="font-semibold">Agent</p>
                    <p>{(job?.stats?.agentRecommendation || storedResult?.agentRecommendation)?.summary}</p>
                  </div>
                )}
                {visibleEvaluation?.scores?.length ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p className="font-semibold">Poradní pořadí</p>
                    {visibleEvaluation.scores.slice(0, 3).map((score) => (
                      <p key={score.displayLabel}>{score.rank}. {score.displayLabel} · {score.totalScore.toLocaleString('cs-CZ')} bodů</p>
                    ))}
                  </div>
                ) : null}
                {(job?.stats?.normalizations || storedResult?.normalizations)?.some((item) => item.reviewCount > 0) && (
                  <div className={`rounded-lg border px-3 py-2 ${getStatusTone('warn')}`}>
                    <p className="font-semibold">Normalizované vstupy ke kontrole</p>
                    {(job?.stats?.normalizations || storedResult?.normalizations || [])
                      .filter((item) => item.reviewCount > 0)
                      .map((item) => (
                        <p key={`${item.supplierName}-${item.sourceFileName}`}>
                          {item.supplierName}: {item.reviewCount} z {item.itemCount} položek
                        </p>
                      ))}
                  </div>
                )}
                {roleSummary.zadaniCount === 0 && files.length > 0 && (
                  <div className={`rounded-lg border px-3 py-2 ${getStatusTone('warn')}`}>
                    <p className="font-semibold">Alternativní ocenění</p>
                    <p>Rozpočet chybí, porovnání se vytvoří z dodavatelských nabídek.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {blockingReasons.length === 0 ? (
                  <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${getStatusTone('ok')}`}>
                    Matice je připravená ke spuštění.
                  </div>
                ) : (
                  blockingReasons.map((reason) => (
                    <div key={reason} className={`rounded-lg border px-3 py-2 text-xs ${getStatusTone('warn')}`}>
                      {reason}
                    </div>
                  ))
                )}
              </div>

              {autoStatus && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p>
                    Auto: <span className="font-semibold">{autoStatus.state}</span>
                  </p>
                  <p>
                    Poslední běh:{' '}
                    {autoStatus.lastRunAt
                      ? new Date(autoStatus.lastRunAt).toLocaleString('cs-CZ')
                      : 'zatím neproběhl'}
                  </p>
                  {autoStatus.pendingReason !== 'none' && <p>Čekání: {autoStatus.pendingReason}</p>}
                  {autoStatus.lastError && <p className="text-rose-600 dark:text-rose-400">{autoStatus.lastError}</p>}
                </div>
              )}

              <div className="space-y-2">
                {(job?.outputLatestPath || job?.outputPath) && job.status === 'success' && (
                  <button
                    type="button"
                    onClick={() => void openOutputFile()}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary/90"
                  >
                    Otevřít hotové porovnání
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void startComparison()}
                  className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canStart || isStarting || jobIsRunning || Math.abs(weightTotal - 100) > 0.001}
                >
                  {isStarting ? 'Spouštím porovnání...' : job?.status === 'success' ? 'Přepočítat nabídky' : 'Porovnat nabídky'}
                </button>
                <details className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Kritéria a váhy ({weightTotal.toLocaleString('cs-CZ')} %)
                  </summary>
                  <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['price', 'Cena'],
                        ['completeness', 'Úplnost'],
                        ['commercialTerms', 'Podmínky'],
                        ['supplierHistory', 'Historie'],
                        ['priceRisk', 'Cenová rizika'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="text-xs text-slate-600 dark:text-slate-300">
                          {label} %
                          <input
                            aria-label={`${label} váha`}
                            type="number"
                            min={0}
                            max={100}
                            value={fileConfig.weights[key]}
                            onChange={(event) => setFileConfig((current) => ({
                              ...current,
                              weights: { ...current.weights, [key]: Number(event.target.value) },
                            }))}
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                          />
                        </label>
                      ))}
                    </div>
                    {Math.abs(weightTotal - 100) > 0.001 ? (
                      <p className="text-xs font-semibold text-rose-600">Součet vah musí být 100 %.</p>
                    ) : null}
                    {supplierOptions.map((supplier) => {
                      const criteria = fileConfig.suppliers[supplier] || EMPTY_CRITERIA;
                      return (
                        <details key={supplier} className="rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold">{supplier}</summary>
                          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-2 text-xs dark:border-slate-700">
                            <label>Termín<input aria-label={`${supplier} termín`} type="date" value={criteria.realizationDate || ''} onChange={(event) => updateSupplierCriteria(supplier, { realizationDate: event.target.value || null })} className="mt-1 w-full rounded border px-1 py-1 dark:bg-slate-950" /></label>
                            <label>Záruka měs.<input aria-label={`${supplier} záruka`} type="number" min={0} max={240} value={criteria.warrantyMonths ?? ''} onChange={(event) => updateSupplierCriteria(supplier, { warrantyMonths: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded border px-1 py-1 dark:bg-slate-950" /></label>
                            <label>Splatnost dnů<input aria-label={`${supplier} splatnost`} type="number" min={0} max={365} value={criteria.maturityDays ?? ''} onChange={(event) => updateSupplierCriteria(supplier, { maturityDays: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded border px-1 py-1 dark:bg-slate-950" /></label>
                            <label>Rating 1–5<input aria-label={`${supplier} rating`} type="number" min={1} max={5} step={0.1} value={criteria.supplierRating ?? ''} onChange={(event) => updateSupplierCriteria(supplier, { supplierRating: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded border px-1 py-1 dark:bg-slate-950" /></label>
                            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={criteria.scopeConfirmed === true} onChange={(event) => updateSupplierCriteria(supplier, { scopeConfirmed: event.target.checked })} /> Rozsah nabídky potvrzen</label>
                            <label className="col-span-2">Poznámka<textarea aria-label={`${supplier} poznámka`} maxLength={1000} value={criteria.note} onChange={(event) => updateSupplierCriteria(supplier, { note: event.target.value })} className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-950" /></label>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
                <button
                  type="button"
                  onClick={openAgentSettings}
                  className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Pokročilé nastavení
                </button>
                {jobIsRunning && (
                  <button
                    type="button"
                    onClick={() => void cancelJob()}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-500"
                  >
                    Zrušit job
                  </button>
                )}
              </div>
            </aside>
          </div>

          <section className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detail vstupů a přiřazení</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Servisní pohled pro ruční opravu, když automatika netrefí roli nebo dodavatele.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(job?.outputLatestPath || job?.outputPath) && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          void openOutputFile();
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        Zobrazit výstup
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          void openTenderFolder();
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        Otevřít složku VŘ
                      </button>
                    </>
                  )}
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {files.length} souborů
                  </span>
                  <span className="text-xs font-semibold text-primary group-open:hidden">Upravit přiřazení</span>
                  <span className="hidden text-xs font-semibold text-primary group-open:inline">Skrýt detail</span>
                </div>
              </summary>

              {files.length === 0 ? (
                <div className="border-t border-slate-200 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Nejsou načtené žádné soubory. Zadejte složku a spusťte detekci.
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800/50">
                      <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-2">Soubor</th>
                        <th className="px-3 py-2">Typ</th>
                        <th className="px-3 py-2">Dodavatel</th>
                        <th className="px-3 py-2">Kolo</th>
                        <th className="px-3 py-2">Stav</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file, index) => {
                        const isOffer = file.role === 'offer';
                        return (
                          <tr key={file.path} className="border-t border-slate-200 dark:border-slate-700 align-top">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-800 dark:text-slate-100">{file.relativePath}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.sizeBytes)}</p>
                              {file.referenceSource === 'mapped_budget_attachment' && (
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-300">Mapovaná základní poptávka</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                aria-label={`Typ souboru ${file.fileName}`}
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
                                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                              >
                                <option
                                  value="zadani"
                                  disabled={!canBeReferenceFile(file)}
                                >
                                  Zadání
                                </option>
                                <option value="offer">Nabídka</option>
                                <option value="ignore">Příloha / ignorovat</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                aria-label={`Dodavatel pro ${file.fileName}`}
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
                                className="min-w-[190px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
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
                                aria-label={`Kolo pro ${file.fileName}`}
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
                                className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              {file.analysisError ? (
                                <span className="text-rose-600">{file.analysisError}</span>
                              ) : file.requiresNormalization ? (
                                <span>
                                  {getRoleLabel(file.role)} · {file.sourceFormat?.toUpperCase() || 'dokument'} · bude normalizováno {file.sourceFormat === 'csv' ? 'lokálně' : 'přes API'}
                                </span>
                              ) : file.analysis ? (
                                <span>
                                  {getRoleLabel(file.role)} · K řádky {file.analysis.kRows}, oceněné {file.analysis.pricedKRows}
                                </span>
                              ) : (
                                <span>{getRoleLabel(file.role)} · bez analýzy</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </details>

            {job && (
              <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3">
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

                {job.error && <p className="text-sm text-rose-600 dark:text-rose-400">{job.error}</p>}

                {job.stats && (
                  <div className="grid gap-2 md:grid-cols-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      {job.stats.sourceMode === 'offers_only' ? 'Položek z nabídek' : 'Položek v zadání'}: {job.stats.pocetPolozek}
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      Agent: {agentStatusText}
                      {job.agentRecommendationWrittenAt && (
                        <span> · doporučení zapsáno {new Date(job.agentRecommendationWrittenAt).toLocaleString('cs-CZ')}</span>
                      )}
                    </div>
                    {(Object.entries(job.stats.suppliers) as [string, { sparovano: number }][]).map(([label, supplierStats]) => (
                      <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                        {label}: {supplierStats.sparovano}/{job.stats?.pocetPolozek} spárováno
                      </div>
                    ))}
                  </div>
                )}

                {job.agentAnalysisError && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{job.agentAnalysisError}</p>
                )}

                <div className="max-h-32 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-950/40">
                  {job.logs.map((log, index) => (
                    <p key={`${log}-${index}`} className="text-xs text-slate-600 dark:text-slate-300">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
