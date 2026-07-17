import { ipcMain } from "electron";
import { testBidComparisonHermesConnection } from "../../services/bidComparisonHermes";
import { getBidComparisonRunner } from "../../services/bidComparisonRunner";
import { SecureStorageService } from "../../services/secureStorage";
import { loadBidComparisonConfig, loadBidComparisonResult, saveBidComparisonConfig } from "../../services/bidComparisonWorkspace";
import type {
  BidComparisonAgentConfig,
  BidComparisonAgentTestResult,
  BidComparisonAutoConfig,
  BidComparisonAutoScope,
  BidComparisonAutoStartResult,
  BidComparisonAutoStatus,
  BidComparisonDetectionResult,
  BidComparisonFileConfig,
  BidComparisonJobStatus,
  BidComparisonSelectedFileInput,
  BidComparisonStartInput,
  BidComparisonStartResult,
  BidComparisonSupplierOption,
  BidComparisonWorkspaceState,
} from "../../types";

export const BID_COMPARISON_AGENT_SECRET_KEY = 'bid_comparison_agent_secret_v1';

interface BidComparisonAutoRunnerLike {
  autoStart: (config: BidComparisonAutoConfig) => Promise<BidComparisonAutoStartResult>;
  autoStop: (scope: BidComparisonAutoScope) => Promise<{ success: boolean }>;
  autoStatus: (scope: BidComparisonAutoScope) => Promise<BidComparisonAutoStatus | null>;
  autoList: () => Promise<BidComparisonAutoStatus[]>;
}

interface BidComparisonHandlerDependencies {
  resolvePortableReadPath: (targetPath: string) => Promise<string>;
  bidComparisonAutoRunner: BidComparisonAutoRunnerLike;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

export const registerBidComparisonHandlers = ({
  resolvePortableReadPath,
  bidComparisonAutoRunner,
  requireAuth,
}: BidComparisonHandlerDependencies): void => {
  const secureStorage = new SecureStorageService();
  ipcMain.handle(
    "bid-comparison:detect-inputs",
    async (
      event,
      args: {
        tenderFolderPath: string;
        suppliers?: BidComparisonSupplierOption[];
      },
    ): Promise<BidComparisonDetectionResult> => {
      requireAuth(event.sender, 'bid-comparison:detect-inputs');
      const resolvedTenderFolderPath = await resolvePortableReadPath(args.tenderFolderPath);
      return getBidComparisonRunner().detectInputs({
        tenderFolderPath: resolvedTenderFolderPath,
        suppliers: Array.isArray(args.suppliers) ? args.suppliers : [],
      });
    },
  );

  ipcMain.handle("bid-comparison:start", async (event, input: BidComparisonStartInput): Promise<BidComparisonStartResult> => {
    requireAuth(event.sender, 'bid-comparison:start');
    const resolvedTenderFolderPath = await resolvePortableReadPath(input.tenderFolderPath);
    const resolvedSelectedFiles: BidComparisonSelectedFileInput[] = await Promise.all(
      (input.selectedFiles || []).map(async (selectedFile) => ({
        ...selectedFile,
        path: await resolvePortableReadPath(selectedFile.path),
      })),
    );
    return getBidComparisonRunner().start({
      ...input,
      tenderFolderPath: resolvedTenderFolderPath,
      selectedFiles: resolvedSelectedFiles,
    });
  });

  ipcMain.handle("bid-comparison:get", async (event, jobId: string): Promise<BidComparisonJobStatus | null> => {
    requireAuth(event.sender, 'bid-comparison:get');
    return getBidComparisonRunner().get(jobId);
  });

  ipcMain.handle(
    "bid-comparison:list",
    async (event, filter?: { projectId?: string; categoryId?: string }): Promise<BidComparisonJobStatus[]> => {
      requireAuth(event.sender, 'bid-comparison:list');
      return getBidComparisonRunner().list(filter);
    },
  );

  ipcMain.handle("bid-comparison:cancel", async (event, jobId: string): Promise<{ success: boolean }> => {
    requireAuth(event.sender, 'bid-comparison:cancel');
    return getBidComparisonRunner().cancel(jobId);
  });

  ipcMain.handle(
    "bid-comparison:test-agent",
    async (event, config: BidComparisonAgentConfig): Promise<BidComparisonAgentTestResult> => {
      requireAuth(event.sender, 'bid-comparison:test-agent');
      const transientSecret = config.bearerToken?.trim();
      const secret = transientSecret || await secureStorage.get(BID_COMPARISON_AGENT_SECRET_KEY) || '';
      return testBidComparisonHermesConnection({ ...config, bearerToken: undefined }, secret);
    },
  );

  ipcMain.handle('bid-comparison:load-workspace', async (event, tenderFolderPath: string): Promise<BidComparisonWorkspaceState> => {
    requireAuth(event.sender, 'bid-comparison:load-workspace');
    const resolved = await resolvePortableReadPath(tenderFolderPath);
    const [config, result, secret] = await Promise.all([
      loadBidComparisonConfig(resolved),
      loadBidComparisonResult(resolved),
      secureStorage.get(BID_COMPARISON_AGENT_SECRET_KEY),
    ]);
    return { config, result, hasAgentSecret: Boolean(secret) };
  });

  ipcMain.handle('bid-comparison:save-config', async (event, tenderFolderPath: string, config: BidComparisonFileConfig): Promise<BidComparisonFileConfig> => {
    requireAuth(event.sender, 'bid-comparison:save-config');
    const resolved = await resolvePortableReadPath(tenderFolderPath);
    return saveBidComparisonConfig(resolved, config);
  });

  ipcMain.handle('bid-comparison:save-agent-secret', async (event, secret: string): Promise<void> => {
    requireAuth(event.sender, 'bid-comparison:save-agent-secret');
    const normalized = String(secret || '').trim();
    if (normalized.length < 16 || normalized.length > 4096) throw new Error('API token musí mít 16 až 4096 znaků.');
    await secureStorage.set(BID_COMPARISON_AGENT_SECRET_KEY, normalized);
  });

  ipcMain.handle('bid-comparison:has-agent-secret', async (event): Promise<boolean> => {
    requireAuth(event.sender, 'bid-comparison:has-agent-secret');
    return Boolean(await secureStorage.get(BID_COMPARISON_AGENT_SECRET_KEY));
  });

  ipcMain.handle('bid-comparison:clear-agent-secret', async (event): Promise<void> => {
    requireAuth(event.sender, 'bid-comparison:clear-agent-secret');
    await secureStorage.delete(BID_COMPARISON_AGENT_SECRET_KEY);
  });

  ipcMain.handle(
    "bid-comparison:auto-start",
    async (event, config: BidComparisonAutoConfig): Promise<BidComparisonAutoStartResult> => {
      requireAuth(event.sender, 'bid-comparison:auto-start');
      const resolvedTenderFolderPath = await resolvePortableReadPath(config.tenderFolderPath);
      const resolvedSelectedFiles: BidComparisonSelectedFileInput[] = await Promise.all(
        (config.selectedFiles || []).map(async (selectedFile) => ({
          ...selectedFile,
          path: await resolvePortableReadPath(selectedFile.path),
        })),
      );
      return bidComparisonAutoRunner.autoStart({
        ...config,
        tenderFolderPath: resolvedTenderFolderPath,
        selectedFiles: resolvedSelectedFiles,
      });
    },
  );

  ipcMain.handle(
    "bid-comparison:auto-stop",
    async (event, scope: BidComparisonAutoScope): Promise<{ success: boolean }> => {
      requireAuth(event.sender, 'bid-comparison:auto-stop');
      return bidComparisonAutoRunner.autoStop(scope);
    },
  );

  ipcMain.handle(
    "bid-comparison:auto-status",
    async (event, scope: BidComparisonAutoScope): Promise<BidComparisonAutoStatus | null> => {
      requireAuth(event.sender, 'bid-comparison:auto-status');
      return bidComparisonAutoRunner.autoStatus(scope);
    },
  );

  ipcMain.handle("bid-comparison:auto-list", async (event): Promise<BidComparisonAutoStatus[]> => {
    requireAuth(event.sender, 'bid-comparison:auto-list');
    return bidComparisonAutoRunner.autoList();
  });
};
