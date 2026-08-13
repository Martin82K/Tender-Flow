import type {
  BackupFileEntry,
  BackupSettingsInfo,
  FileInfo,
  FolderInfo,
  FolderSnapshot,
  SessionCredentialsSaveResult,
  UpdateStatus,
} from "../types";

export interface IpcContractMap {
  "fs:selectFolder": { args: []; result: FolderInfo | null };
  "fs:selectFile": {
    args: [options?: { title?: string; defaultPath?: string }];
    result: FileInfo | null;
  };
  "fs:listFiles": { args: [folderPath: string]; result: FileInfo[] };
  "fs:readFile": {
    args: [filePath: string, options?: { maxBytes?: number }];
    result: Buffer;
  };
  "fs:copyFile": {
    args: [sourcePath: string, destinationDirectory: string];
    result: { success: boolean; path?: string; name?: string; size?: number; error?: string };
  };
  "fs:writeFile": { args: [filePath: string, data: Buffer | string]; result: void };
  "fs:openInExplorer": {
    args: [targetPath: string];
    result: { success: boolean; error?: string };
  };
  "fs:openFile": {
    args: [filePath: string];
    result: { success: boolean; error?: string };
  };
  "fs:showItemInFolder": {
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
    result: SessionCredentialsSaveResult;
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
  "oauth:googleLogin": {
    args: [args: { clientId: string; scopes: string[] }];
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
  "updater:getStatus": { args: []; result: UpdateStatus };
  "backup:getSettings": { args: []; result: BackupSettingsInfo };
  "backup:setEnabled": { args: [enabled: boolean]; result: void };
  "backup:setScheduledTime": { args: [time: string]; result: void };
  "backup:save": { args: [jsonContent: string, backupType: 'user' | 'tenant' | 'contacts', organizationId: string]; result: string };
  "backup:read": { args: [filePath: string]; result: string };
  "backup:list": { args: []; result: BackupFileEntry[] };
  "backup:getFolder": { args: []; result: string };
  "backup:openFolder": { args: []; result: { success: boolean; error?: string } };
  "backup:clean": { args: []; result: number };
  "auth:setAuthenticated": {
    args: [authenticated: boolean, session?: { accessToken?: string | null; expiresAt?: number | null }];
    result: void;
  };
  "auth:invokePublicFunction": {
    args: [
      functionName: "request-password-reset" | "confirm-password-reset",
      body: unknown,
    ];
    result: {
      ok: boolean;
      status: number;
      statusText: string;
      text: string;
      headers: Record<string, string>;
    };
  };
  "app:setThemeSource": { args: [source: 'light' | 'dark' | 'system']; result: void };
}

export type IpcChannel = keyof IpcContractMap;
