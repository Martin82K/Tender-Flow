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
 */
export class AutoUpdaterService {
    private mainWindow: BrowserWindow | null = null;
    private updateStatus: UpdateStatus = { status: 'not-available' };

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
     * Check for available updates
     */
    async checkForUpdates(): Promise<boolean> {
        try {
            this.updateStatus = { status: 'checking' };
            this.sendStatusToRenderer();

            const result = await autoUpdater.checkForUpdates();
            return !!result?.updateInfo;
        } catch (error) {
            console.error('Update check failed:', error);
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
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error('Update download failed:', error);
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
            this.updateStatus = { status: 'checking' };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('update-available', (info: UpdateInfo) => {
            this.updateStatus = { status: 'available', info };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('update-not-available', (info: UpdateInfo) => {
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
            this.updateStatus = { status: 'downloaded', info };
            this.sendStatusToRenderer();
        });

        autoUpdater.on('error', (error: Error) => {
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
