/**
 * Platform Adapter - bridges web and desktop implementations
 * Use this to conditionally access platform-specific features
 */

import type {
    ElectronAPI,
    FolderInfo,
    FileInfo,
    FolderSnapshot,
    BackupSettingsInfo,
    BackupFileEntry,
    BidComparisonDetectionResult,
    BidComparisonStartInput,
    BidComparisonStartResult,
    BidComparisonJobStatus,
    BidComparisonAutoConfig,
    BidComparisonAutoScope,
    BidComparisonAutoStartResult,
    BidComparisonAutoStatus,
} from '../shared/types/desktop';

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
 * On web: returns unavailable fallback values
 */
export const fileSystemAdapter = {
    /**
     * Select a folder using system dialog (desktop only)
     */
    async selectFolder(): Promise<FolderInfo | null> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.selectFolder();
        }
        // Web: not supported
        console.warn('Folder selection not available on web.');
        return null;
    },

    /**
     * List files in a folder
     */
    async listFiles(folderPath: string): Promise<FileInfo[]> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.listFiles(folderPath);
        }
        // Web: not supported
        console.warn('File listing not available on web.');
        return [];
    },

    /**
     * Open a file in native application
     */
    async openFile(filePath: string): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.openFile(filePath);
        }
        // Web: try to open as URL
        window.open(filePath, '_blank');
        return { success: true };
    },

    /**
     * Show file in system file explorer
     */
    async openInExplorer(folderPath: string): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.fs.openInExplorer(folderPath);
        }
        // Web: not possible
        console.warn('Cannot open explorer on web.');
        return { success: false, error: 'Cannot open explorer on web.' };
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

    /**
     * Grant access to a folder path outside default allowed roots (desktop only).
     * Used for paths on non-system drives (e.g. D:\, network shares).
     */
    async grantAccess(folderPath: string): Promise<boolean> {
        if (isDesktop && window.electronAPI?.fs?.grantAccess) {
            return window.electronAPI.fs.grantAccess(folderPath);
        }
        return false;
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
    },

    async openUserManual(): Promise<void> {
        if (isDesktop && window.electronAPI) {
            return window.electronAPI.app.openUserManual();
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

export interface McpStatusInfo {
    port: number | null;
    sseUrl: string | null;
    currentProjectId: string | null;
    hasAuthToken: boolean;
    isConfigured: boolean;
}

export interface OAuthGoogleLoginArgs {
    clientId: string;
    clientSecret?: string;
    scopes: string[];
}

export interface OAuthGoogleLoginResult {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn: number;
    scope?: string | null;
    tokenType: string;
    idToken?: string | null;
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
 * MCP Adapter
 * MCP runtime status and auth context synchronization
 */
export const mcpAdapter = {
    async setCurrentProject(projectId: string | null): Promise<void> {
        if (isDesktop && window.electronAPI?.mcp?.setCurrentProject) {
            return window.electronAPI.mcp.setCurrentProject(projectId);
        }
    },

    async setAuthToken(token: string | null): Promise<void> {
        if (isDesktop && window.electronAPI?.mcp?.setAuthToken) {
            return window.electronAPI.mcp.setAuthToken(token);
        }
    },

    async getStatus(): Promise<McpStatusInfo | null> {
        if (isDesktop && window.electronAPI?.mcp?.getStatus) {
            return window.electronAPI.mcp.getStatus();
        }
        return null;
    },
};

/**
 * OAuth Adapter
 * Desktop OAuth flow exposed via preload bridge
 */
export const oauthAdapter = {
    isAvailable(): boolean {
        return !!(isDesktop && window.electronAPI?.oauth?.googleLogin);
    },

    async googleLogin(args: OAuthGoogleLoginArgs): Promise<OAuthGoogleLoginResult> {
        if (isDesktop && window.electronAPI?.oauth?.googleLogin) {
            return window.electronAPI.oauth.googleLogin(args);
        }
        throw new Error('Desktop OAuth není dostupný.');
    },
};

/**
 * Bid Comparison Adapter
 * Desktop-only async bid comparison jobs
 */
export const bidComparisonAdapter = {
    isAvailable(): boolean {
        return !!(isDesktop && window.electronAPI?.bidComparison);
    },

    async detectInputs(args: {
        tenderFolderPath: string;
        suppliers: Array<{ name: string }>;
    }): Promise<BidComparisonDetectionResult> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.detectInputs(args);
        }
        throw new Error('Porovnání nabídek je dostupné pouze v desktop aplikaci.');
    },

    async start(input: BidComparisonStartInput): Promise<BidComparisonStartResult> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.start(input);
        }
        throw new Error('Porovnání nabídek je dostupné pouze v desktop aplikaci.');
    },

    async get(jobId: string): Promise<BidComparisonJobStatus | null> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.get(jobId);
        }
        return null;
    },

    async cancel(jobId: string): Promise<{ success: boolean }> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.cancel(jobId);
        }
        return { success: false };
    },

    async autoStart(config: BidComparisonAutoConfig): Promise<BidComparisonAutoStartResult> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.autoStart(config);
        }
        throw new Error('Porovnání nabídek je dostupné pouze v desktop aplikaci.');
    },

    async autoStop(scope: BidComparisonAutoScope): Promise<{ success: boolean }> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.autoStop(scope);
        }
        return { success: false };
    },

    async autoStatus(scope: BidComparisonAutoScope): Promise<BidComparisonAutoStatus | null> {
        if (isDesktop && window.electronAPI?.bidComparison) {
            return window.electronAPI.bidComparison.autoStatus(scope);
        }
        return null;
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
const WEB_SESSION_CREDENTIALS_KEY = 'session_credentials';

const readWebSessionCredentials = (): { refreshToken: string; email: string } | null => {
    const fromSession = sessionStorage.getItem(WEB_SESSION_CREDENTIALS_KEY);
    const fromLegacyLocal = localStorage.getItem(WEB_SESSION_CREDENTIALS_KEY);
    const raw = fromSession || fromLegacyLocal;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as { refreshToken?: string; email?: string };
        if (!parsed?.refreshToken || !parsed?.email) return null;

        if (!fromSession && fromLegacyLocal) {
            sessionStorage.setItem(WEB_SESSION_CREDENTIALS_KEY, raw);
            localStorage.removeItem(WEB_SESSION_CREDENTIALS_KEY);
        }

        return { refreshToken: parsed.refreshToken, email: parsed.email };
    } catch {
        return null;
    }
};

export const sessionAdapter = {
    /**
     * Save session credentials securely
     */
    async saveCredentials(credentials: { refreshToken: string; email: string }): Promise<void> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.saveCredentials(credentials);
        }

        // Web fallback: use sessionStorage and explicitly clear any legacy localStorage copy.
        sessionStorage.setItem(WEB_SESSION_CREDENTIALS_KEY, JSON.stringify(credentials));
        localStorage.removeItem(WEB_SESSION_CREDENTIALS_KEY);
    },

    /**
     * Get stored session credentials
     */
    async getCredentials(): Promise<{ refreshToken: string; email: string } | null> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.getCredentials();
        }

        return readWebSessionCredentials();
    },

    /**
     * Clear stored session credentials
     */
    async clearCredentials(): Promise<void> {
        if (isDesktop && window.electronAPI && window.electronAPI.session) {
            return window.electronAPI.session.clearCredentials();
        }

        sessionStorage.removeItem(WEB_SESSION_CREDENTIALS_KEY);
        localStorage.removeItem(WEB_SESSION_CREDENTIALS_KEY);
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

    async openTempBinaryFile(base64Content: string, filename: string): Promise<void> {
        console.log('[shellAdapter] openTempBinaryFile called:', filename);
        if (isDesktop && window.electronAPI && window.electronAPI.shell && window.electronAPI.shell.openTempBinaryFile) {
            try {
                await window.electronAPI.shell.openTempBinaryFile(base64Content, filename);
                console.log('[shellAdapter] openTempBinaryFile completed');
            } catch (error) {
                console.error('[shellAdapter] openTempBinaryFile failed:', error);
                throw error;
            }
            return;
        }

        const binary = atob(base64Content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};

/**
 * Desktop Notification Adapter
 * Shows native OS notifications on desktop, Web Notifications API on web
 */
export const desktopNotificationAdapter = {
    async show(title: string, body?: string): Promise<void> {
        if (isDesktop && window.electronAPI?.notification) {
            await window.electronAPI.notification.show({ title, body });
        } else if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body });
        }
    },

    async requestPermission(): Promise<boolean> {
        if (isDesktop) return true; // Electron doesn't need permission
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;
        const result = await Notification.requestPermission();
        return result === "granted";
    },
};

/**
 * Backup Adapter
 * Local backup file management on desktop
 */
export const backupAdapter = {
    isAvailable(): boolean {
        return !!(isDesktop && window.electronAPI?.backup);
    },

    async getSettings(): Promise<BackupSettingsInfo> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.getSettings();
        }
        return { enabled: false, backupFolderPath: '', lastBackupAt: null, lastBackupError: null };
    },

    async setEnabled(enabled: boolean): Promise<void> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.setEnabled(enabled);
        }
    },

    async save(jsonContent: string, backupType: 'user' | 'tenant' | 'contacts', organizationId: string): Promise<string> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.save(jsonContent, backupType, organizationId);
        }
        throw new Error('Záloha je dostupná pouze v desktop aplikaci.');
    },

    async read(filePath: string): Promise<string> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.read(filePath);
        }
        throw new Error('Záloha je dostupná pouze v desktop aplikaci.');
    },

    async list(): Promise<BackupFileEntry[]> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.list();
        }
        return [];
    },

    async getFolder(): Promise<string> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.getFolder();
        }
        return '';
    },

    async openFolder(): Promise<{ success: boolean; error?: string }> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.openFolder();
        }
        return { success: false, error: 'Dostupné pouze v desktop aplikaci.' };
    },

    async clean(): Promise<number> {
        if (isDesktop && window.electronAPI?.backup) {
            return window.electronAPI.backup.clean();
        }
        return 0;
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
    mcp: mcpAdapter,
    oauth: oauthAdapter,
    bidComparison: bidComparisonAdapter,
    biometric: biometricAdapter,
    session: sessionAdapter,
    shell: shellAdapter,
    notification: desktopNotificationAdapter,
    backup: backupAdapter,
};

export default platformAdapter;
