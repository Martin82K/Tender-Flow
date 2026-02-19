import { contextBridge, ipcRenderer } from 'electron';
import type {
    ElectronAPI,
    FolderInfo,
    FileInfo,
    FolderSnapshot,
    UpdateStatus,
    BidComparisonSupplierOption,
    BidComparisonDetectionResult,
    BidComparisonStartInput,
    BidComparisonStartResult,
    BidComparisonJobStatus,
    BidComparisonAutoConfig,
    BidComparisonAutoStartResult,
    BidComparisonAutoScope,
    BidComparisonAutoStatus,
} from './types';
import type { IpcChannel, IpcContractMap } from './ipc/contracts';

console.log('[Preload] Script starting...');
try {
    console.log('[Preload] Exposing electronAPI');
} catch (e) {
    console.error('[Preload] Error starting:', e);
}

/**
 * Preload script - exposes safe APIs to the renderer process
 * All IPC communication goes through this bridge
 */
const invokeTyped = <C extends IpcChannel>(
    channel: C,
    ...args: IpcContractMap[C]['args']
): Promise<IpcContractMap[C]['result']> => {
    return ipcRenderer.invoke(channel, ...(args as unknown as any[]));
};

const electronAPI: ElectronAPI = {
    // Platform detection
    platform: {
        isDesktop: true,
        isWeb: false,
        os: process.platform,
        version: process.versions.electron,
    },

    // File system operations
    fs: {
        selectFolder: (): Promise<FolderInfo | null> =>
            invokeTyped('fs:selectFolder'),

        listFiles: (folderPath: string): Promise<FileInfo[]> =>
            invokeTyped('fs:listFiles', folderPath),

        readFile: (filePath: string): Promise<Buffer> =>
            invokeTyped('fs:readFile', filePath),

        writeFile: (filePath: string, data: Buffer | string): Promise<void> =>
            invokeTyped('fs:writeFile', filePath, data),

        openInExplorer: (path: string): Promise<void> =>
            invokeTyped('fs:openInExplorer', path),

        openFile: (filePath: string): Promise<void> =>
            invokeTyped('fs:openFile', filePath),

        createFolder: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
            invokeTyped('fs:createFolder', folderPath),

        deleteFolder: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
            invokeTyped('fs:deleteFolder', folderPath),

        renameFolder: (oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
            invokeTyped('fs:renameFolder', oldPath, newPath),

        folderExists: (folderPath: string): Promise<boolean> =>
            invokeTyped('fs:folderExists', folderPath),
    },

    // Folder watcher
    watcher: {
        start: (folderPath: string): Promise<void> =>
            invokeTyped('watcher:start', folderPath),

        stop: (): Promise<void> =>
            invokeTyped('watcher:stop'),

        getSnapshot: (): Promise<FolderSnapshot | null> =>
            invokeTyped('watcher:getSnapshot'),

        onFileChange: (callback: (event: string, path: string) => void) => {
            const handler = (_: unknown, event: string, path: string) => callback(event, path);
            ipcRenderer.on('watcher:fileChange', handler);
            return () => ipcRenderer.removeListener('watcher:fileChange', handler);
        },
    },

    // App functions
    app: {
        getVersion: (): Promise<string> =>
            ipcRenderer.invoke('app:getVersion'),

        checkForUpdates: (): Promise<boolean> =>
            ipcRenderer.invoke('updater:checkForUpdates'),

        quitAndInstall: (): Promise<void> =>
            ipcRenderer.invoke('updater:quitAndInstall'),

        quit: (): Promise<void> =>
            ipcRenderer.invoke('app:quit'),

        openUserManual: (): Promise<void> =>
            ipcRenderer.invoke('app:openUserManual'),

        getUserDataPath: (): Promise<string> =>
            ipcRenderer.invoke('app:getUserDataPath'),
    },

    // Secure storage (for tokens)
    storage: {
        get: (key: string): Promise<string | null> =>
            ipcRenderer.invoke('storage:get', key),

        set: (key: string, value: string): Promise<void> =>
            ipcRenderer.invoke('storage:set', key, value),

        delete: (key: string): Promise<void> =>
            ipcRenderer.invoke('storage:delete', key),
    },

    // Dialog helpers
    dialog: {
        showMessage: (options: { type?: string; title?: string; message: string; buttons?: string[] }): Promise<number> =>
            ipcRenderer.invoke('dialog:showMessage', options),

        showError: (title: string, content: string): Promise<void> =>
            ipcRenderer.invoke('dialog:showError', title, content),
    },

    // Auto-updater
    updater: {
        checkForUpdates: (): Promise<boolean> =>
            ipcRenderer.invoke('updater:checkForUpdates'),

        downloadUpdate: (): Promise<void> =>
            ipcRenderer.invoke('updater:downloadUpdate'),

        quitAndInstall: (): Promise<void> =>
            ipcRenderer.invoke('updater:quitAndInstall'),

        getStatus: (): Promise<UpdateStatus> =>
            invokeTyped('updater:getStatus'),

        onStatusChange: (callback: (status: UpdateStatus) => void) => {
            const handler = (_: unknown, status: UpdateStatus) => callback(status);
            ipcRenderer.on('updater:statusChanged', handler);
            return () => ipcRenderer.removeListener('updater:statusChanged', handler);
        },
    },

    // Biometric authentication (Touch ID / Face ID / Windows Hello)
    biometric: {
        isAvailable: (): Promise<boolean> =>
            ipcRenderer.invoke('biometric:isAvailable'),

        prompt: (reason: string): Promise<boolean> =>
            ipcRenderer.invoke('biometric:prompt', reason),
    },

    // Session credential management
    session: {
        saveCredentials: (credentials: { refreshToken: string; email: string }): Promise<void> =>
            invokeTyped('session:saveCredentials', credentials),

        getCredentials: (): Promise<{ refreshToken: string; email: string } | null> =>
            invokeTyped('session:getCredentials'),

        clearCredentials: (): Promise<void> =>
            invokeTyped('session:clearCredentials'),

        setBiometricEnabled: (enabled: boolean): Promise<void> =>
            invokeTyped('session:setBiometricEnabled', enabled),

        isBiometricEnabled: (): Promise<boolean> =>
            invokeTyped('session:isBiometricEnabled'),
    },

    // Network proxy for CORS bypass
    net: {
        request: (url: string, options?: RequestInit): Promise<any> =>
            invokeTyped('net:request', url, options),
    },

    oauth: {
        googleLogin: (args: { clientId: string; clientSecret?: string; scopes: string[] }) => {
            console.log('[Preload] OAuth Login Request:', {
                clientId: args.clientId,
                hasSecret: !!args.clientSecret,
                scopes: args.scopes
            });
            return invokeTyped('oauth:googleLogin', args);
        },
    },

    mcp: {
        setCurrentProject: (projectId: string | null): Promise<void> =>
            invokeTyped('mcp:setCurrentProject', projectId),
        setAuthToken: (token: string | null): Promise<void> =>
            invokeTyped('mcp:setAuthToken', token),
        getStatus: (): Promise<{
            port: number | null;
            sseUrl: string | null;
            currentProjectId: string | null;
            hasAuthToken: boolean;
            isConfigured: boolean;
        }> =>
            invokeTyped('mcp:getStatus'),
    },

    shell: {
        openExternal: (url: string): Promise<void> =>
            ipcRenderer.invoke('shell:openExternal', url),
        openTempFile: (content: string, filename: string): Promise<void> =>
            ipcRenderer.invoke('shell:openTempFile', content, filename),
        convertToDocx: (inputPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
            ipcRenderer.invoke('shell:convertToDocx', inputPath),
    },

    bidComparison: {
        detectInputs: (args: { tenderFolderPath: string; suppliers: BidComparisonSupplierOption[] }): Promise<BidComparisonDetectionResult> =>
            invokeTyped('bid-comparison:detect-inputs', args),

        start: (input: BidComparisonStartInput): Promise<BidComparisonStartResult> =>
            invokeTyped('bid-comparison:start', input),

        get: (jobId: string): Promise<BidComparisonJobStatus | null> =>
            invokeTyped('bid-comparison:get', jobId),

        list: (filter?: { projectId?: string; categoryId?: string }): Promise<BidComparisonJobStatus[]> =>
            invokeTyped('bid-comparison:list', filter),

        cancel: (jobId: string): Promise<{ success: boolean }> =>
            invokeTyped('bid-comparison:cancel', jobId),

        autoStart: (config: BidComparisonAutoConfig): Promise<BidComparisonAutoStartResult> =>
            invokeTyped('bid-comparison:auto-start', config),

        autoStop: (scope: BidComparisonAutoScope): Promise<{ success: boolean }> =>
            invokeTyped('bid-comparison:auto-stop', scope),

        autoStatus: (scope: BidComparisonAutoScope): Promise<BidComparisonAutoStatus | null> =>
            invokeTyped('bid-comparison:auto-status', scope),

        autoList: (): Promise<BidComparisonAutoStatus[]> =>
            invokeTyped('bid-comparison:auto-list'),
    },
};

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
