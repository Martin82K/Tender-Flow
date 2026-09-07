import { autoUpdater, NsisUpdater } from 'electron-updater';
import { compare, gt, valid } from 'semver';
import { BrowserWindow, ipcMain, app } from 'electron';

import { applyNoCacheUpdateRequestHeaders } from './updateRequestHeaders';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';

type AutoUpdaterClient = Pick<
    typeof autoUpdater,
    | 'allowDowngrade'
    | 'autoDownload'
    | 'autoInstallOnAppQuit'
    | 'requestHeaders'
    | 'forceDevUpdateConfig'
    | 'checkForUpdates'
    | 'downloadUpdate'
    | 'quitAndInstall'
    | 'on'
>;

// Explicit, trusted public sources; no GitHub token is shipped to clients.
export const UPDATE_REPOSITORIES = ['Tender-Flow-Releases', 'Tender-Flow'] as const;
const SOURCE_TIMEOUT_MS = 15_000;

const createUpdateSources = (): AutoUpdaterClient[] => process.platform === 'win32'
    ? UPDATE_REPOSITORIES.map(repo => new NsisUpdater({
        provider: 'github', owner: 'Martin82K', repo, private: false,
    }))
    : [autoUpdater];

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
    private selectedSource: AutoUpdaterClient | null = null;
    private checkPromise: Promise<boolean> | null = null;
    private downloadPromise: Promise<void> | null = null;
    private readonly pendingSources = new Set<AutoUpdaterClient>();

    private readonly isDevMode = process.env.NODE_ENV === 'development' || !app.isPackaged;
    private readonly isWinAutoUpdateEnabled = process.platform === 'win32';
    private readonly isMacArmManualMode = process.platform === 'darwin' && process.arch === 'arm64';

    constructor(private readonly sources: AutoUpdaterClient[] = createUpdateSources()) {
        for (const source of sources) {
            // Probe without downloading. Only the selected, newest eligible source may download.
            source.autoDownload = false;
            source.autoInstallOnAppQuit = true;
            source.allowDowngrade = false;
            applyNoCacheUpdateRequestHeaders(source);
            if (this.isDevMode) source.forceDevUpdateConfig = true;
            if (this.isWinAutoUpdateEnabled) this.setupEventListeners(source);
        }

        if (this.isMacArmManualMode) {
            console.log('[AutoUpdater] macOS arm64 manual update mode enabled (no auto-update)');
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
    checkForUpdates(): Promise<boolean> {
        if (!this.isWinAutoUpdateEnabled || this.isDevMode) {
            this.updateStatus = { status: 'not-available' };
            this.sendStatusToRenderer();
            return Promise.resolve(false);
        }
        if (this.checkPromise) return this.checkPromise;
        // A new check must never replace provider metadata for an in-flight/cached installer.
        if (this.downloadPromise || this.updateStatus.status === 'downloaded') return Promise.resolve(true);
        this.checkPromise = this.checkSources().finally(() => { this.checkPromise = null; });
        return this.checkPromise;
    }

    private async probe(source: AutoUpdaterClient) {
        if (this.pendingSources.has(source)) throw new Error('Previous source check is still pending');
        this.pendingSources.add(source);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const request = Promise.resolve().then(() => source.checkForUpdates())
            .finally(() => { this.pendingSources.delete(source); });
        try {
            return await Promise.race([
                request,
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Update source timed out')), SOURCE_TIMEOUT_MS);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    private async checkSources(): Promise<boolean> {
        this.selectedSource = null;
        this.updateStatus = { status: 'checking' };
        this.sendStatusToRenderer();
        const checks = await Promise.allSettled(this.sources.map(source => this.probe(source)));
        const candidates: { source: AutoUpdaterClient; info: UpdateInfo }[] = [];
        let checkedSource = false;
        checks.forEach((check, index) => {
            if (check.status !== 'fulfilled' || !check.value?.updateInfo) return;
            const { updateInfo, isUpdateAvailable } = check.value;
            if (!valid(updateInfo.version)) return;
            checkedSource = true;
            // Retain electron-updater's OS/staged-rollout checks as well as version ordering.
            if (isUpdateAvailable && gt(updateInfo.version, app.getVersion())) {
                candidates.push({ source: this.sources[index], info: updateInfo });
            }
        });
        // Stable sort keeps the new repository first for equal versions.
        candidates.sort((a, b) => compare(b.info.version, a.info.version));
        const selected = candidates[0];
        if (!selected) {
            this.updateStatus = checkedSource ? { status: 'not-available' } : {
                status: 'error',
                error: 'Aktualizace se nepodařilo ověřit v žádném zdroji. Zkuste to prosím později.',
            };
            this.sendStatusToRenderer();
            return false;
        }
        this.selectedSource = selected.source;
        this.updateStatus = { status: 'available', info: selected.info };
        this.sendStatusToRenderer();
        void this.downloadUpdate();
        return true;
    }

    /** Download only from the selected provider; never fall back after integrity failure. */
    downloadUpdate(): Promise<void> {
        if (!this.isWinAutoUpdateEnabled || !this.selectedSource || this.updateStatus.status === 'downloaded') {
            return Promise.resolve();
        }
        if (this.downloadPromise) return this.downloadPromise;
        const source = this.selectedSource;
        this.updateStatus = { status: 'downloading', info: this.updateStatus.info };
        this.sendStatusToRenderer();
        this.downloadPromise = Promise.resolve().then(() => source.downloadUpdate())
            .then(() => undefined)
            .catch((error: unknown) => {
                this.updateStatus = {
                    status: 'error', info: this.updateStatus.info,
                    error: error instanceof Error ? error.message : 'Download failed',
                };
                this.sendStatusToRenderer();
            })
            .finally(() => { this.downloadPromise = null; });
        return this.downloadPromise;
    }

    /**
     * Install update and restart app
     */
    quitAndInstall(): void {
        if (!this.isWinAutoUpdateEnabled || this.updateStatus.status !== 'downloaded') {
            return;
        }

        console.log('[AutoUpdater] Installing update and restarting...');
        this.selectedSource?.quitAndInstall(true, true);
    }

    /**
     * Get current update status
     */
    getStatus(): UpdateStatus {
        return this.updateStatus;
    }

    private setupEventListeners(source: AutoUpdaterClient): void {
        // Probe events deliberately stay local. A failed/late secondary source must not
        // overwrite the selected download, emit a false error, or enable installation.
        source.on('download-progress', (progress: ProgressInfo) => {
            if (source !== this.selectedSource || this.updateStatus.status !== 'downloading') return;
            this.updateStatus = { status: 'downloading', progress, info: this.updateStatus.info };
            this.sendStatusToRenderer();
        });
        source.on('update-downloaded', (info: UpdateInfo) => {
            if (source !== this.selectedSource || this.updateStatus.status !== 'downloading'
                || info.version !== this.updateStatus.info?.version) return;
            this.updateStatus = { status: 'downloaded', info };
            this.sendStatusToRenderer();
        });
        source.on('error', (error: Error) => {
            if (source !== this.selectedSource || !this.downloadPromise) return;
            this.updateStatus = { status: 'error', error: error.message, info: this.updateStatus.info };
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
