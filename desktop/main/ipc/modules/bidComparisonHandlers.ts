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
}

export const registerBidComparisonHandlers = ({
  resolvePortableReadPath,
  bidComparisonAutoRunner,
}: BidComparisonHandlerDependencies): void => {
  ipcMain.handle(
    "bid-comparison:detect-inputs",
    async (
      _,
      args: {
        tenderFolderPath: string;
        suppliers?: BidComparisonSupplierOption[];
      },
    ): Promise<BidComparisonDetectionResult> => {
      const resolvedTenderFolderPath = await resolvePortableReadPath(args.tenderFolderPath);
      return getBidComparisonRunner().detectInputs({
        tenderFolderPath: resolvedTenderFolderPath,
        suppliers: Array.isArray(args.suppliers) ? args.suppliers : [],
      });
    },
  );

  ipcMain.handle("bid-comparison:start", async (_, input: BidComparisonStartInput): Promise<BidComparisonStartResult> => {
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

  ipcMain.handle("bid-comparison:get", async (_, jobId: string): Promise<BidComparisonJobStatus | null> => {
    return getBidComparisonRunner().get(jobId);
  });

  ipcMain.handle(
    "bid-comparison:list",
    async (_, filter?: { projectId?: string; categoryId?: string }): Promise<BidComparisonJobStatus[]> => {
      return getBidComparisonRunner().list(filter);
    },
  );

  ipcMain.handle("bid-comparison:cancel", async (_, jobId: string): Promise<{ success: boolean }> => {
    return getBidComparisonRunner().cancel(jobId);
  });

  ipcMain.handle(
    "bid-comparison:auto-start",
    async (_, config: BidComparisonAutoConfig): Promise<BidComparisonAutoStartResult> => {
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
    async (_, scope: BidComparisonAutoScope): Promise<{ success: boolean }> => {
      return bidComparisonAutoRunner.autoStop(scope);
    },
  );

  ipcMain.handle(
    "bid-comparison:auto-status",
    async (_, scope: BidComparisonAutoScope): Promise<BidComparisonAutoStatus | null> => {
      return bidComparisonAutoRunner.autoStatus(scope);
    },
  );

  ipcMain.handle("bid-comparison:auto-list", async (): Promise<BidComparisonAutoStatus[]> => {
    return bidComparisonAutoRunner.autoList();
  });
};
