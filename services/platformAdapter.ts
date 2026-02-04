/**
 * Platform Adapter - bridges web and desktop implementations
 * Use this to conditionally access platform-specific features
 */

import type { ElectronAPI, FolderInfo, FileInfo, FolderSnapshot } from '../desktop/main/types';

// Extend Window interface for TypeScript
declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

// Platform detection
export const isDesktop = typeof window !== 'undefined' && window.electronAPI?.platform?.isDesktop;


export const isWeb = !isDesktop;
export const platform = window.electronAPI?.platform ?? {
    isDesktop: false,
    isWeb: true,
    os: 'web' as NodeJS.Platform,
    version: '',
};

/**
 * File System Adapter
 * On desktop: uses native fs through Electron IPC
 * On web: falls back to MCP bridge or returns null
 */
export const fileSystemAdapter = {
    /**
     * Select a folder using system dialog (desktop only)
     */
    async selectFolder(): Promise<FolderInfo | null> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.selectFolder();
        }
        // Web: not supported - use MCP bridge connection UI
        console.warn('Folder selection not available on web. Use MCP bridge.');
        return null;
    },

    /**
     * List files in a folder
     */
    async listFiles(folderPath: string): Promise<FileInfo[]> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.listFiles(folderPath);
        }
        // Web: would need MCP bridge
        console.warn('File listing not available on web without MCP.');
        return [];
    },

    /**
     * Open a file in native application
     */
    async openFile(filePath: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.openFile(filePath);
        }
        // Web: try to open as URL
        window.open(filePath, '_blank');
    },

    /**
     * Show file in system file explorer
     */
    async openInExplorer(folderPath: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.openInExplorer(folderPath);
        }
        // Web: not possible
        console.warn('Cannot open explorer on web.');
    },

    /**
     * Create a folder (desktop only)
     */
    async createFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.createFolder(folderPath);
        }
        return { success: false, error: 'Folder creation not available on web.' };
    },

    /**
     * Delete a folder (desktop only)
     */
    async deleteFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.deleteFolder(folderPath);
        }
        return { success: false, error: 'Folder deletion not available on web.' };
    },

    /**
     * Check if folder exists (desktop only)
     */
    async folderExists(folderPath: string): Promise<boolean> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.folderExists(folderPath);
        }
        return false;
    },

    /**
     * Rename a folder (desktop only)
     */
    async renameFolder(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.renameFolder(oldPath, newPath);
        }
        return { success: false, error: 'Folder renaming not available on web.' };
    },
};

/**
 * Folder Watcher Adapter
 * Provides real-time file change notifications on desktop
 */
export const watcherAdapter = {
    async start(folderPath: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.watcher.start(folderPath);
        }
        console.warn('Folder watcher not available on web.');
    },

    async stop(): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.watcher.stop();
        }
    },

    async getSnapshot(): Promise<FolderSnapshot | null> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.watcher.getSnapshot();
        }
        return null;
    },

    onFileChange(callback: (event: string, path: string) => void): (() => void) | undefined {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.watcher.onFileChange(callback);
        }
        return undefined;
    },
};

/**
 * Secure Storage Adapter
 * On desktop: uses OS keychain/credential manager
 * On web: uses localStorage (less secure, but functional)
 */
export const storageAdapter = {
    async get(key: string): Promise<string | null> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.storage.get(key);
        }
        // Web: use localStorage
        return localStorage.getItem(key);
    },

    async set(key: string, value: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.storage.set(key, value);
        }
        // Web: use localStorage
        localStorage.setItem(key, value);
    },

    async delete(key: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.storage.delete(key);
        }
        // Web: use localStorage
        localStorage.removeItem(key);
    },
};

/**
 * App Adapter
 * Version checking, updates, etc.
 */
export const appAdapter = {
    async getVersion(): Promise<string> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.app.getVersion();
        }
        // Web: return from build config
        return import.meta.env.VITE_APP_VERSION ?? '0.0.0';
    },

    async checkForUpdates(): Promise<boolean> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.app.checkForUpdates();
        }
        // Web: always "up to date"
        return false;
    },

    async quit(): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.app.quit();
        }
    }
};

/**
 * Dialog Adapter
 * Native OS dialogs on desktop, browser alerts on web
 */
export const dialogAdapter = {
    async showMessage(options: { type?: string; title?: string; message: string; buttons?: string[] }): Promise<number> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.dialog.showMessage(options);
        }
        // Web: use confirm for questions, alert for others
        if (options.buttons && options.buttons.length > 1) {
            const result = confirm(`${options.title ? options.title + '\n\n' : ''}${options.message}`);
            return result ? 0 : 1;
        }
        alert(`${options.title ? options.title + '\n\n' : ''}${options.message}`);
        return 0;
    },

    async showError(title: string, content: string): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.dialog.showError(title, content);
        }
        // Web: use alert
        alert(`${title}\n\n${content}`);
    },
};

/**
 * Update Status type for renderer
 */
export interface UpdateStatusInfo {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
    error?: string;
}

/**
 * Updater Adapter
 * Auto-update functionality on desktop
 */
export const updaterAdapter = {
    async checkForUpdates(): Promise<boolean> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.updater.checkForUpdates();
        }
        return false;
    },

    async downloadUpdate(): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.updater.downloadUpdate();
        }
    },

    async quitAndInstall(): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.updater.quitAndInstall();
        }
    },

    async getStatus(): Promise<UpdateStatusInfo> {
        if (isDesktop && window.electronAPI) {
            const status = await window.electronAPI.updater.getStatus();
            return {
                status: status.status,
                version: status.info?.version,
                percent: status.progress?.percent,
                error: status.error,
            };
        }
        return { status: 'not-available' };
    },

    onStatusChange(callback: (status: UpdateStatusInfo) => void): (() => void) | undefined {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.updater.onStatusChange((status) => {
                callback({
                    status: status.status,
                    version: status.info?.version,
                    percent: status.progress?.percent,
                    error: status.error,
                });
            });
        }
        return undefined;
    },
};

/**
 * Biometric Authentication Adapter
 * Biometric authentication on desktop (Touch ID / Face ID / Windows Hello)
 */
export const biometricAdapter = {
    /**
     * Check if biometric authentication is available
     */
    async isAvailable(): Promise<boolean> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.biometric.isAvailable();
        }
        return false;
    },

    /**
     * Prompt user for biometric authentication
     * @param reason - Reason displayed to user (e.g., "unlock Tender Flow")
     * @returns true if authentication successful
     */
    async prompt(reason: string): Promise<boolean> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.biometric.prompt(reason);
        }
        return false;
    },
};

/**
 * Session Credentials Adapter
 * Secure storage for session tokens with biometric protection
 */
export const sessionAdapter = {
    /**
     * Save session credentials securely
     */
    async saveCredentials(credentials: { refreshToken: string; email: string }): Promise<void> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.saveCredentials(credentials);
        }
        console.warn('Session API not available on desktop, falling back to localStorage');
        // Web: store in localStorage (less secure)
        localStorage.setItem('session_credentials', JSON.stringify(credentials));
    },

    /**
     * Get stored session credentials
     */
    async getCredentials(): Promise<{ refreshToken: string; email: string } | null> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.getCredentials();
        }
        // Web: get from localStorage
        const data = localStorage.getItem('session_credentials');
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    },

    /**
     * Clear stored session credentials
     */
    async clearCredentials(): Promise<void> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.clearCredentials();
        }
        // Web: remove from localStorage
        localStorage.removeItem('session_credentials');
    },

    /**
     * Enable or disable biometric unlock
     */
    async setBiometricEnabled(enabled: boolean): Promise<void> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.setBiometricEnabled(enabled);
        }
        // Web: store preference
        localStorage.setItem('biometric_enabled', enabled ? 'true' : 'false');
    },

    /**
     * Check if biometric unlock is enabled
     */
    async isBiometricEnabled(): Promise<boolean> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.isBiometricEnabled();
        }
        // Web: check localStorage
        return localStorage.getItem('biometric_enabled') === 'true';
    },
};

// Combined platform adapter
/**
 * Shell Adapter
 * Open external links
 */
export const shellAdapter = {
    async openExternal(url: string): Promise<void> {
        console.log('[shellAdapter] openExternal called with URL:', url);
        console.log('[shellAdapter] isDesktop:', isDesktop);
        console.log('[shellAdapter] electronAPI available:', !!window.electronAPI);
        console.log('[shellAdapter] shell API available:', !!(window.electronAPI?.shell));

        if (isDesktop && window.electronAPI && window.electronAPI.shell) {
            console.log('[shellAdapter] Using IPC to open external URL');
            try {
                await window.electronAPI.shell.openExternal(url);
                console.log('[shellAdapter] IPC call completed');
            } catch (error) {
                console.error('[shellAdapter] IPC call failed:', error);
                throw error;
            }
            return;
        }
        // Web: use window.open
        console.log('[shellAdapter] Falling back to window.open');
        window.open(url, '_blank');
    },

    async openTempFile(content: string, filename: string): Promise<void> {
        console.log('[shellAdapter] openTempFile called:', filename);
        if (isDesktop && window.electronAPI && window.electronAPI.shell && window.electronAPI.shell.openTempFile) {
            try {
                await window.electronAPI.shell.openTempFile(content, filename);
                console.log('[shellAdapter] openTempFile completed');
            } catch (error) {
                console.error('[shellAdapter] openTempFile failed:', error);
                throw error;
            }
            return;
        }
        // Web fallback: trigger download
        console.log('[shellAdapter] openTempFile not available, triggering download');
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};

// Combined platform adapter
export const platformAdapter = {
    isDesktop,
    isWeb,
    platform,
    fs: fileSystemAdapter,
    watcher: watcherAdapter,
    storage: storageAdapter,
    app: appAdapter,
    dialog: dialogAdapter,
    updater: updaterAdapter,
    biometric: biometricAdapter,
    session: sessionAdapter,
    shell: shellAdapter,
};

export default platformAdapter;
