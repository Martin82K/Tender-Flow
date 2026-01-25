import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, FolderInfo, FileInfo, FolderSnapshot, UpdateStatus } from './types';

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
            ipcRenderer.invoke('fs:selectFolder'),

        listFiles: (folderPath: string): Promise<FileInfo[]> =>
            ipcRenderer.invoke('fs:listFiles', folderPath),

        readFile: (filePath: string): Promise<Buffer> =>
            ipcRenderer.invoke('fs:readFile', filePath),

        writeFile: (filePath: string, data: Buffer | string): Promise<void> =>
            ipcRenderer.invoke('fs:writeFile', filePath, data),

        openInExplorer: (path: string): Promise<void> =>
            ipcRenderer.invoke('fs:openInExplorer', path),

        openFile: (filePath: string): Promise<void> =>
            ipcRenderer.invoke('fs:openFile', filePath),

        createFolder: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('fs:createFolder', folderPath),

        deleteFolder: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('fs:deleteFolder', folderPath),

        renameFolder: (oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('fs:renameFolder', oldPath, newPath),

        folderExists: (folderPath: string): Promise<boolean> =>
            ipcRenderer.invoke('fs:folderExists', folderPath),
    },

    // Folder watcher
    watcher: {
        start: (folderPath: string): Promise<void> =>
            ipcRenderer.invoke('watcher:start', folderPath),

        stop: (): Promise<void> =>
            ipcRenderer.invoke('watcher:stop'),

        getSnapshot: (): Promise<FolderSnapshot | null> =>
            ipcRenderer.invoke('watcher:getSnapshot'),

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
            ipcRenderer.invoke('updater:getStatus'),

        onStatusChange: (callback: (status: UpdateStatus) => void) => {
            const handler = (_: unknown, status: UpdateStatus) => callback(status);
            ipcRenderer.on('updater:statusChanged', handler);
            return () => ipcRenderer.removeListener('updater:statusChanged', handler);
        },
    },

    // Biometric authentication (Touch ID / Face ID)
    biometric: {
        isAvailable: (): Promise<boolean> =>
            ipcRenderer.invoke('biometric:isAvailable'),

        prompt: (reason: string): Promise<boolean> =>
            ipcRenderer.invoke('biometric:prompt', reason),
    },

    // Session credential management
    session: {
        saveCredentials: (credentials: { refreshToken: string; email: string }): Promise<void> =>
            ipcRenderer.invoke('session:saveCredentials', credentials),

        getCredentials: (): Promise<{ refreshToken: string; email: string } | null> =>
            ipcRenderer.invoke('session:getCredentials'),

        clearCredentials: (): Promise<void> =>
            ipcRenderer.invoke('session:clearCredentials'),

        setBiometricEnabled: (enabled: boolean): Promise<void> =>
            ipcRenderer.invoke('session:setBiometricEnabled', enabled),

        isBiometricEnabled: (): Promise<boolean> =>
            ipcRenderer.invoke('session:isBiometricEnabled'),
    },

    // Network proxy for CORS bypass
    net: {
        request: (url: string, options?: RequestInit): Promise<any> =>
            ipcRenderer.invoke('net:request', url, options),
    },

    oauth: {
        googleLogin: (args: { clientId: string; clientSecret?: string; scopes: string[] }) => {
            console.log('[Preload] OAuth Login Request:', {
                clientId: args.clientId,
                hasSecret: !!args.clientSecret,
                scopes: args.scopes
            });
            return ipcRenderer.invoke('oauth:googleLogin', args);
        },
    },

    mcp: {
        setCurrentProject: (projectId: string | null): Promise<void> =>
            ipcRenderer.invoke('mcp:setCurrentProject', projectId),
        setAuthToken: (token: string | null): Promise<void> =>
            ipcRenderer.invoke('mcp:setAuthToken', token),
        getStatus: (): Promise<{
            port: number | null;
            sseUrl: string | null;
            currentProjectId: string | null;
            hasAuthToken: boolean;
            isConfigured: boolean;
        }> =>
            ipcRenderer.invoke('mcp:getStatus'),
    },

    shell: {
        openExternal: (url: string): Promise<void> =>
            ipcRenderer.invoke('shell:openExternal', url),
        openTempFile: (content: string, filename: string): Promise<void> =>
            ipcRenderer.invoke('shell:openTempFile', content, filename),
        convertToDocx: (inputPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
            ipcRenderer.invoke('shell:convertToDocx', inputPath),
    },
};

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
