import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';

export interface UpdateStatus {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: UpdateInfo;
    progress?: ProgressInfo;
    error?: string;
}

/**
 * Auto-updater service for managing application updates
 * Uses electron-updater with GitHub provider backend
 * Automatically checks for updates every 6 hours
 */
export class AutoUpdaterService {
    private mainWindow: BrowserWindow | null = null;
    private updateStatus: UpdateStatus = { status: 'not-available' };
    private checkInterval: NodeJS.Timeout | null = null;
    private updateCheckIntervalHours: number = 6;

    private readonly isDevMode = process.env.NODE_ENV === 'development' || !app.isPackaged;
    private readonly isWinAutoUpdateEnabled = process.platform === 'win32';
    private readonly isMacArmManualMode = process.platform === 'darwin' && process.arch === 'arm64';

    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        // For development, allow local update config (dev-app-update.yml)
        if (this.isDevMode) {
            autoUpdater.forceDevUpdateConfig = true;
        }

        if (this.isWinAutoUpdateEnabled) {
            console.log('[AutoUpdater] Windows auto-update mode enabled (GitHub Releases)');
            this.setupEventListeners();
        } else if (this.isMacArmManualMode) {
            console.log('[AutoUpdater] macOS arm64 manual update mode enabled (no auto-update)');
        } else {
            console.log('[AutoUpdater] Auto-update disabled on this platform:', process.platform, process.arch);
        }

        this.registerIpcHandlers();
    }

    /**
     * Set the main window for sending update events
     */
    setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window;
    }

    /**
     * Start periodic update checks
     */
    startPeriodicChecks(): void {
        if (!this.isWinAutoUpdateEnabled || this.isDevMode) {
            console.log('[AutoUpdater] Periodic checks disabled for current platform/mode');
            return;
        }

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        const intervalMs = this.updateCheckIntervalHours * 60 * 60 * 1000;
        console.log(`[AutoUpdater] Starting periodic checks every ${this.updateCheckIntervalHours} hours`);

        this.checkInterval = setInterval(() => {
            console.log('[AutoUpdater] Running scheduled update check');
            void this.checkForUpdates();
        }, intervalMs);
    }

    /**
     * Stop periodic update checks
     */
    stopPeriodicChecks(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[AutoUpdater] Periodic checks stopped');
        }
    }

    /**
     * Set the interval for periodic checks (in hours)
     */
    setCheckInterval(hours: number): void {
        this.updateCheckIntervalHours = hours;
        if (this.checkInterval) {
            this.stopPeriodicChecks();
            this.startPeriodicChecks();
        }
    }

    /**
     * Check for available updates
     */
    async checkForUpdates(): Promise<boolean> {
        if (!this.isWinAutoUpdateEnabled) {
            this.updateStatus = { status: 'not-available' };
            this.sendStatusToRenderer();
            return false;
        }

        try {
            this.updateStatus = { status: 'checking' };
            this.sendStatusToRenderer();

            if (this.isDevMode) {
                console.log('[AutoUpdater] Skipping real update check in development mode');
                this.updateStatus = { status: 'not-available' };
                this.sendStatusToRenderer();
                return false;
            }

            console.log('[AutoUpdater] Checking for updates via GitHub Releases...');
            const result = await autoUpdater.checkForUpdates();

            if (result?.updateInfo) {
                console.log('[AutoUpdater] Update check result:', {
                    currentVersion: app.getVersion(),
                    latestVersion: result.updateInfo.version,
                    hasUpdate: !!result.updateInfo,
                });
            }

            return !!result?.updateInfo;
        } catch (error) {
            console.error('[AutoUpdater] Update check failed:', error);
            this.updateStatus = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            this.sendStatusToRenderer();
            return false;
        }
    }

    /**
     * Download the available update
     */
    async downloadUpdate(): Promise<void> {
        if (!this.isWinAutoUpdateEnabled) {
            this.updateStatus = { status: 'not-available' };
            this.sendStatusToRenderer();
            return;
        }

        try {
            console.log('[AutoUpdater] Starting update download...');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error('[AutoUpdater] Update download failed:', error);
            this.updateStatus = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Download failed',
            };
            this.sendStatusToRenderer();
        }
    }

    /**
     * Install update and restart app
     */
    quitAndInstall(): void {
        if (!this.isWinAutoUpdateEnabled) {
            return;
        }

        console.log('[AutoUpdater] Installing update and restarting...');
        autoUpdater.quitAndInstall(false, true);
    }

    /**
     * Get current update status
     */
    getStatus(): UpdateStatus {
        return this.updateStatus;
    }

    private setupEventListeners(): void {
        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Event: checking-for-update');
            this.updateStatus = { status: 'checking' };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('update-available', (info: UpdateInfo) => {
            console.log('[AutoUpdater] Event: update-available', info.version);
            this.updateStatus = { status: 'available', info };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('update-not-available', (info: UpdateInfo) => {
            console.log('[AutoUpdater] Event: update-not-available', info.version);
            this.updateStatus = { status: 'not-available', info };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('download-progress', (progress: ProgressInfo) => {
            this.updateStatus = {
                status: 'downloading',
                progress,
                info: this.updateStatus.info,
            };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
            console.log('[AutoUpdater] Event: update-downloaded', info.version);
            this.updateStatus = { status: 'downloaded', info };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('error', (error: Error) => {
            console.error('[AutoUpdater] Event: error', error);
            this.updateStatus = { status: 'error', error: error.message };
            this.sendStatusToRenderer();
        });
    }

    private registerIpcHandlers(): void {
        ipcMain.handle('updater:checkForUpdates', async () => {
            return this.checkForUpdates();
        });

        ipcMain.handle('updater:downloadUpdate', async () => {
            await this.downloadUpdate();
        });

        ipcMain.handle('updater:quitAndInstall', () => {
            this.quitAndInstall();
        });

        ipcMain.handle('updater:getStatus', () => {
            return this.updateStatus;
        });
    }

    private sendStatusToRenderer(): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('updater:statusChanged', this.updateStatus);
        }
    }
}

// Singleton instance
let autoUpdaterService: AutoUpdaterService | null = null;

export function getAutoUpdaterService(): AutoUpdaterService {
    if (!autoUpdaterService) {
        autoUpdaterService = new AutoUpdaterService();
    }
    return autoUpdaterService;
}

export default AutoUpdaterService;
