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

type UpdateSourceFactory = () => AutoUpdaterClient;
interface UpdateSource {
    create: UpdateSourceFactory;
    client: AutoUpdaterClient | null;
}
type SourceResult = Awaited<ReturnType<AutoUpdaterClient['checkForUpdates']>>;
interface UpdateCandidate { source: AutoUpdaterClient; info: UpdateInfo; }

const isDownloadTransportError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    // Allow only known transport failures. Integrity, certificate, permission and
    // unknown errors must stop the update even when another mirror is available.
    if ('code' in error && typeof error.code === 'string') {
        return /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND|HTTP_ERROR_(403|404|408|410|429|5\d\d))$/.test(error.code);
    }
    // builder-util-runtime download HTTP errors and timeouts have no error code.
    return /^Cannot download "https?:\/\/[^"\r\n]+", status (403|404|408|410|429|5\d\d):/.test(error.message)
        || error.message === 'Request timed out'
        || /^net::ERR_(CONNECTION_(RESET|REFUSED|CLOSED|TIMED_OUT|FAILED)|TIMED_OUT|INTERNET_DISCONNECTED|NETWORK_CHANGED|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE)$/.test(error.message);
};

const isIdenticalMirror = (selected: UpdateInfo, other: UpdateInfo): boolean => {
    if (compare(selected.version, other.version) !== 0 || !Array.isArray(selected.files)
        || !Array.isArray(other.files) || selected.files.length === 0
        || selected.files.length !== other.files.length) return false;
    const identities = (info: UpdateInfo) => info.files.map(file => `${file.sha512}:${file.size ?? ''}`).sort();
    if ([...selected.files, ...other.files].some(file => !file.sha512)) return false;
    return JSON.stringify(identities(selected)) === JSON.stringify(identities(other));
};

const createUpdateSourceFactories = (): UpdateSourceFactory[] => process.platform === 'win32'
    ? UPDATE_REPOSITORIES.map(repo => () => new NsisUpdater({
        provider: 'github', owner: 'Martin82K', repo, private: false,
    }))
    : [() => autoUpdater];

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
    private downloadCandidates: UpdateCandidate[] = [];
    private readonly sources: UpdateSource[];

    private readonly isDevMode = process.env.NODE_ENV === 'development' || !app.isPackaged;
    private readonly isWinAutoUpdateEnabled = process.platform === 'win32';
    private readonly isMacArmManualMode = process.platform === 'darwin' && process.arch === 'arm64';

    constructor(sourceFactories: UpdateSourceFactory[] = createUpdateSourceFactories()) {
        this.sources = sourceFactories.map(create => ({ create, client: this.configureSource(create()) }));

        if (this.isMacArmManualMode) {
            console.log('[AutoUpdater] macOS arm64 manual update mode enabled (no auto-update)');
        }

        this.registerIpcHandlers();
    }

    private configureSource(source: AutoUpdaterClient): AutoUpdaterClient {
        // Probe without downloading. Only the selected, newest eligible source may download.
        source.autoDownload = false;
        source.autoInstallOnAppQuit = true;
        source.allowDowngrade = false;
        applyNoCacheUpdateRequestHeaders(source);
        if (this.isDevMode) source.forceDevUpdateConfig = true;
        if (this.isWinAutoUpdateEnabled) this.setupEventListeners(source);
        return source;
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

    private async probe(source: UpdateSource): Promise<{ client: AutoUpdaterClient; result: SourceResult }> {
        const client = source.client ?? this.configureSource(source.create());
        source.client = client;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        const request = Promise.resolve().then(() => client.checkForUpdates());
        try {
            const result = await Promise.race([
                request,
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        timedOut = true;
                        reject(new Error('Update source timed out'));
                    }, SOURCE_TIMEOUT_MS);
                }),
            ]);
            return { client, result };
        } catch (error) {
            // Metadata checks have no public cancellation API. Retire the instance:
            // the next attempt gets a fresh request and cannot reuse its stuck promise.
            // Its late events stay ignored because it can never be selected to download.
            if (timedOut) source.client = null;
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    private async checkSources(): Promise<boolean> {
        this.selectedSource = null;
        this.downloadCandidates = [];
        this.updateStatus = { status: 'checking' };
        this.sendStatusToRenderer();
        // electron-updater creates .updaterId lazily. Serial probes prevent two new
        // instances from racing to overwrite it on first launch and changing rollout cohorts.
        const checks: PromiseSettledResult<{ client: AutoUpdaterClient; result: SourceResult }>[] = [];
        for (const source of this.sources) {
            const [check] = await Promise.allSettled([this.probe(source)]);
            checks.push(check);
        }
        const candidates: UpdateCandidate[] = [];
        let checkedSource = false;
        checks.forEach(check => {
            if (check.status !== 'fulfilled' || !check.value.result?.updateInfo) return;
            const { updateInfo, isUpdateAvailable } = check.value.result;
            if (!valid(updateInfo.version)) return;
            checkedSource = true;
            // Retain electron-updater's OS/staged-rollout checks as well as version ordering.
            if (isUpdateAvailable && gt(updateInfo.version, app.getVersion())) {
                candidates.push({ source: check.value.client, info: updateInfo });
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
        this.downloadCandidates = candidates.filter(candidate => candidate === selected
            || isIdenticalMirror(selected.info, candidate.info));
        this.selectedSource = selected.source;
        this.updateStatus = { status: 'available', info: selected.info };
        this.sendStatusToRenderer();
        void this.downloadUpdate();
        return true;
    }

    /** Retry an identical mirror only for transport failures, never integrity errors. */
    downloadUpdate(): Promise<void> {
        if (!this.isWinAutoUpdateEnabled || !this.selectedSource || this.updateStatus.status === 'downloaded') {
            return Promise.resolve();
        }
        if (this.downloadPromise) return this.downloadPromise;
        this.updateStatus = { status: 'downloading', info: this.updateStatus.info };
        this.sendStatusToRenderer();
        this.downloadPromise = Promise.resolve().then(() => this.downloadFromMirrors())
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

    private async downloadFromMirrors(): Promise<void> {
        const start = this.downloadCandidates.findIndex(candidate => candidate.source === this.selectedSource);
        if (start < 0) throw new Error('No update source selected');
        for (let index = start; index < this.downloadCandidates.length; index++) {
            const candidate = this.downloadCandidates[index];
            this.selectedSource = candidate.source;
            this.updateStatus = { status: 'downloading', info: candidate.info };
            this.sendStatusToRenderer();
            try {
                await candidate.source.downloadUpdate();
                return;
            } catch (error) {
                if (!isDownloadTransportError(error) || index === this.downloadCandidates.length - 1) throw error;
            }
        }
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
        // checkForUpdates/downloadUpdate reject with the same emitted error. Their
        // promises decide recovery, so intermediate mirror failures cannot flash a
        // terminal error in the UI. Also consume late errors from retired probes.
        source.on('error', () => {});
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
