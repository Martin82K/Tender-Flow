import { ipcMain } from "electron";
import { getBidComparisonRunner } from "../../services/bidComparisonRunner";
import type {
  BidComparisonAutoConfig,
  BidComparisonAutoScope,
  BidComparisonAutoStartResult,
  BidComparisonAutoStatus,
  BidComparisonDetectionResult,
  BidComparisonJobStatus,
  BidComparisonSelectedFileInput,
  BidComparisonStartInput,
  BidComparisonStartResult,
  BidComparisonSupplierOption,
} from "../../types";

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
