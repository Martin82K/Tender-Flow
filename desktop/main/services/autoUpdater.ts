import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';

export interface UpdateStatus {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: UpdateInfo;
    progress?: ProgressInfo;
    error?: string;
}

/**
 * Auto-updater service for managing application updates
 * Uses electron-updater with GitHub Releases as backend
 * Automatically checks for updates every 6 hours
 */
export class AutoUpdaterService {
    private mainWindow: BrowserWindow | null = null;
    private updateStatus: UpdateStatus = { status: 'not-available' };
    private checkInterval: NodeJS.Timeout | null = null;
    private updateCheckIntervalHours: number = 6;

    constructor() {
        // Configure auto-updater
        autoUpdater.autoDownload = false; // We'll control when to download
        autoUpdater.autoInstallOnAppQuit = true;

        // For development, allow unsigned updates
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            autoUpdater.forceDevUpdateConfig = true;
        }

        this.setupEventListeners();
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
        // Skip in development
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            console.log('[AutoUpdater] Periodic checks disabled in development');
            return;
        }

        // Clear existing interval if any
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        const intervalMs = this.updateCheckIntervalHours * 60 * 60 * 1000;
        console.log(`[AutoUpdater] Starting periodic checks every ${this.updateCheckIntervalHours} hours`);

        this.checkInterval = setInterval(() => {
            console.log('[AutoUpdater] Running scheduled update check');
            this.checkForUpdates();
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
        try {
            this.updateStatus = { status: 'checking' };
            this.sendStatusToRenderer();

            // Skip update check in development to prevent errors
            if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
                console.log('[AutoUpdater] Skipping real update check in development mode');
                this.updateStatus = { status: 'not-available' };
                this.sendStatusToRenderer();
                return false;
            }

            console.log('[AutoUpdater] Checking for updates...');
            const result = await autoUpdater.checkForUpdates();

            if (result?.updateInfo) {
                console.log('[AutoUpdater] Update check result:', {
                    currentVersion: app.getVersion(),
                    latestVersion: result.updateInfo.version,
                    hasUpdate: !!result.updateInfo
                });
            }

            return !!result?.updateInfo;
        } catch (error) {
            console.error('[AutoUpdater] Update check failed:', error);
            this.updateStatus = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.sendStatusToRenderer();
            return false;
        }
    }

    /**
     * Download the available update
     */
    async downloadUpdate(): Promise<void> {
        try {
            console.log('[AutoUpdater] Starting update download...');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error('[AutoUpdater] Update download failed:', error);
            this.updateStatus = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Download failed'
            };
            this.sendStatusToRenderer();
        }
    }

    /**
     * Install update and restart app
     */
    quitAndInstall(): void {
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
                info: this.updateStatus.info
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

