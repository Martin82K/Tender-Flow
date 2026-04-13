import type {
  BackupFileEntry,
  BackupSettingsInfo,
  BidComparisonAutoConfig,
  BidComparisonAutoScope,
  BidComparisonAutoStartResult,
  BidComparisonAutoStatus,
  BidComparisonDetectionResult,
  BidComparisonJobStatus,
  BidComparisonStartInput,
  BidComparisonStartResult,
  BidComparisonSupplierOption,
  FileInfo,
  FolderInfo,
  FolderSnapshot,
  UpdateStatus,
} from "../types";

export interface IpcContractMap {
  "fs:selectFolder": { args: []; result: FolderInfo | null };
  "fs:listFiles": { args: [folderPath: string]; result: FileInfo[] };
  "fs:readFile": { args: [filePath: string]; result: Buffer };
  "fs:writeFile": { args: [filePath: string, data: Buffer | string]; result: void };
  "fs:openInExplorer": {
    args: [targetPath: string];
    result: { success: boolean; error?: string };
  };
  "fs:openFile": {
    args: [filePath: string];
    result: { success: boolean; error?: string };
  };
  "fs:createFolder": {
    args: [folderPath: string];
    result: { success: boolean; error?: string };
  };
  "fs:deleteFolder": {
    args: [folderPath: string];
    result: { success: boolean; error?: string };
  };
  "fs:renameFolder": {
    args: [oldPath: string, newPath: string];
    result: { success: boolean; error?: string };
  };
  "fs:folderExists": { args: [folderPath: string]; result: boolean };
  "fs:grantAccess": { args: [folderPath: string]; result: boolean };
  "watcher:start": { args: [folderPath: string]; result: void };
  "watcher:stop": { args: []; result: void };
  "watcher:getSnapshot": { args: []; result: FolderSnapshot | null };
  "session:saveCredentials": {
    args: [credentials: { refreshToken: string; email: string }];
    result: void;
  };
  "session:getCredentials": {
    args: [];
    result: { refreshToken: string; email: string } | null;
  };
  "session:getCredentialsWithBiometric": {
    args: [reason: string];
    result: { refreshToken: string; email: string } | null;
  };
  "session:clearCredentials": { args: []; result: void };
  "session:setBiometricEnabled": { args: [enabled: boolean]; result: void };
  "session:isBiometricEnabled": { args: []; result: boolean };
  "mcp:setCurrentProject": { args: [projectId: string | null]; result: void };
  "mcp:setAuthToken": { args: [token: string | null]; result: void };
  "mcp:getStatus": {
    args: [];
    result: {
      port: number | null;
      sseUrl: string | null;
      currentProjectId: string | null;
      hasAuthToken: boolean;
      isConfigured: boolean;
    };
  };
  "oauth:googleLogin": {
    args: [args: { clientId: string; clientSecret?: string; scopes: string[] }];
    result: {
      accessToken: string;
      refreshToken?: string | null;
      expiresIn: number;
      scope?: string | null;
      tokenType: string;
      idToken?: string | null;
    };
  };
  "net:request": {
    args: [url: string, options?: RequestInit];
    result: {
      ok: boolean;
      status: number;
      statusText: string;
      text: string;
      headers: Record<string, string>;
    };
  };
  "bid-comparison:detect-inputs": {
    args: [args: { tenderFolderPath: string; suppliers?: BidComparisonSupplierOption[] }];
    result: BidComparisonDetectionResult;
  };
  "bid-comparison:start": { args: [input: BidComparisonStartInput]; result: BidComparisonStartResult };
  "bid-comparison:get": { args: [jobId: string]; result: BidComparisonJobStatus | null };
  "bid-comparison:list": {
    args: [filter?: { projectId?: string; categoryId?: string }];
    result: BidComparisonJobStatus[];
  };
  "bid-comparison:cancel": { args: [jobId: string]; result: { success: boolean } };
  "bid-comparison:auto-start": {
    args: [config: BidComparisonAutoConfig];
    result: BidComparisonAutoStartResult;
  };
  "bid-comparison:auto-stop": {
    args: [scope: BidComparisonAutoScope];
    result: { success: boolean };
  };
  "bid-comparison:auto-status": {
    args: [scope: BidComparisonAutoScope];
    result: BidComparisonAutoStatus | null;
  };
  "bid-comparison:auto-list": { args: []; result: BidComparisonAutoStatus[] };
  "updater:getStatus": { args: []; result: UpdateStatus };
  "backup:getSettings": { args: []; result: BackupSettingsInfo };
  "backup:setEnabled": { args: [enabled: boolean]; result: void };
  "backup:save": { args: [jsonContent: string, backupType: 'user' | 'tenant' | 'contacts', organizationId: string]; result: string };
  "backup:read": { args: [filePath: string]; result: string };
  "backup:list": { args: []; result: BackupFileEntry[] };
  "backup:getFolder": { args: []; result: string };
  "backup:openFolder": { args: []; result: { success: boolean; error?: string } };
  "backup:clean": { args: []; result: number };
  "auth:setAuthenticated": { args: [authenticated: boolean]; result: void };
}

export type IpcChannel = keyof IpcContractMap;
