/**
 * Types for Electron IPC communication
 * Shared between main process and preload
 */

export interface ElectronAPI {
    platform: PlatformInfo;
    fs: FileSystemAPI;
    watcher: WatcherAPI;
    app: AppAPI;
    storage: StorageAPI;
    dialog: DialogAPI;
    updater: UpdaterAPI;
    biometric: BiometricAPI;
    session: SessionAPI;
    net: NetworkAPI;
    oauth: OAuthAPI;
    mcp: McpAPI;
    shell: ShellAPI;
    bidComparison: BidComparisonAPI;
}

export interface ShellAPI {
    openExternal: (url: string) => Promise<void>;
    openTempFile: (content: string, filename: string) => Promise<void>;
    convertToDocx: (inputPath: string) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
}

export interface PlatformInfo {
    isDesktop: boolean;
    isWeb: boolean;
    os: NodeJS.Platform;
    version: string;
}

export interface FileSystemAPI {
    selectFolder: () => Promise<FolderInfo | null>;
    listFiles: (folderPath: string) => Promise<FileInfo[]>;
    readFile: (filePath: string) => Promise<Buffer>;
    writeFile: (filePath: string, data: Buffer | string) => Promise<void>;
    openInExplorer: (path: string) => Promise<void>;
    openFile: (filePath: string) => Promise<void>;
    createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
    deleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    folderExists: (folderPath: string) => Promise<boolean>;
}

export interface WatcherAPI {
    start: (folderPath: string) => Promise<void>;
    stop: () => Promise<void>;
    getSnapshot: () => Promise<FolderSnapshot | null>;
    onFileChange: (callback: (event: string, path: string) => void) => () => void;
}

export interface AppAPI {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<boolean>;
    quitAndInstall: () => Promise<void>;
    quit: () => Promise<void>;
    getUserDataPath: () => Promise<string>;
}

export interface StorageAPI {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
}

export interface DialogAPI {
    showMessage: (options: { type?: string; title?: string; message: string; buttons?: string[] }) => Promise<number>;
    showError: (title: string, content: string) => Promise<void>;
}

export interface UpdaterAPI {
    checkForUpdates: () => Promise<boolean>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    getStatus: () => Promise<UpdateStatus>;
    onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
}

export interface BiometricAPI {
    isAvailable: () => Promise<boolean>;
    prompt: (reason: string) => Promise<boolean>;
}

export interface SessionAPI {
    saveCredentials: (credentials: { refreshToken: string; email: string }) => Promise<void>;
    getCredentials: () => Promise<{ refreshToken: string; email: string } | null>;
    clearCredentials: () => Promise<void>;
    setBiometricEnabled: (enabled: boolean) => Promise<void>;
    isBiometricEnabled: () => Promise<boolean>;
}

export interface NetworkAPI {
    request: (url: string, options?: RequestInit) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        text: string;
        headers: Record<string, string>;
    }>;
}

export interface OAuthAPI {
    googleLogin: (args: { clientId: string; clientSecret?: string; scopes: string[] }) => Promise<{
        accessToken: string;
        refreshToken?: string | null;
        expiresIn: number;
        scope?: string | null;
        tokenType: string;
        idToken?: string | null;
    }>;
}

export interface McpAPI {
    setCurrentProject: (projectId: string | null) => Promise<void>;
    setAuthToken: (token: string | null) => Promise<void>;
    getStatus: () => Promise<{
        port: number | null;
        sseUrl: string | null;
        currentProjectId: string | null;
        hasAuthToken: boolean;
        isConfigured: boolean;
    }>;
}

export type BidComparisonRole = 'ignore' | 'zadani' | 'offer';
export type BidComparisonJobState = 'queued' | 'running' | 'success' | 'error' | 'cancelled';

export interface BidComparisonSupplierOption {
    name: string;
}

export interface BidComparisonDetectionAnalysis {
    headerRow: number | null;
    kRows: number;
    pricedKRows: number;
    columnMap: {
        pc?: number;
        typ?: number;
        kod?: number;
        popis?: number;
        mj?: number;
        mnozstvi?: number;
        jcena?: number;
        celkem?: number;
    };
    isValidTemplate: boolean;
}

export interface BidComparisonDetectedFile {
    path: string;
    relativePath: string;
    fileName: string;
    sizeBytes: number;
    mtimeMs: number;
    suggestedRole: BidComparisonRole;
    suggestedSupplierName: string | null;
    suggestedRound: number;
    analysis: BidComparisonDetectionAnalysis | null;
    analysisError: string | null;
}

export interface BidComparisonDetectionResult {
    tenderFolderPath: string;
    files: BidComparisonDetectedFile[];
    warnings: string[];
}

export interface BidComparisonSelectedFileInput {
    path: string;
    role: BidComparisonRole;
    supplierName?: string | null;
    round?: number;
    mtimeMs?: number;
}

export interface BidComparisonStartInput {
    projectId?: string;
    categoryId?: string;
    tenderFolderPath: string;
    selectedFiles: BidComparisonSelectedFileInput[];
    outputBaseName?: string;
}

export interface BidComparisonStartResult {
    jobId: string;
}

export type BidComparisonAutoState = 'inactive' | 'watching' | 'running' | 'waiting_mapping' | 'error';
export type BidComparisonAutoPendingReason =
    | 'none'
    | 'debounce'
    | 'file_change'
    | 'fallback'
    | 'manual_update'
    | 'pending_rerun'
    | 'unresolved_mapping';

export interface BidComparisonAutoScope {
    projectId: string;
    categoryId: string;
}

export interface BidComparisonAutoConfig extends BidComparisonAutoScope {
    tenderFolderPath: string;
    suppliers: BidComparisonSupplierOption[];
    selectedFiles: BidComparisonSelectedFileInput[];
    enabled: boolean;
    debounceMs?: number;
    fallbackIntervalMinutes?: number;
    outputBaseName?: string;
}

export interface BidComparisonAutoStatus extends BidComparisonAutoScope {
    tenderFolderPath: string;
    enabled: boolean;
    state: BidComparisonAutoState;
    debounceMs: number;
    fallbackIntervalMinutes: number;
    outputBaseName: string;
    pendingReason: BidComparisonAutoPendingReason;
    lastRunAt: string | null;
    lastRunResult: 'success' | 'error' | 'blocked' | null;
    lastJobId: string | null;
    lastError: string | null;
    unresolvedFiles: string[];
    updatedAt: string;
}

export interface BidComparisonAutoStartResult {
    success: boolean;
    status: BidComparisonAutoStatus;
}

export interface BidComparisonJobResult {
    pocetPolozek: number;
    suppliers: Record<string, {
        sparovano: number;
        nesparovano: string[];
        round: number;
        variant: number;
    }>;
}

export interface BidComparisonJobStatus {
    id: string;
    projectId: string | null;
    categoryId: string | null;
    tenderFolderPath: string;
    status: BidComparisonJobState;
    progressPercent: number;
    step: string;
    logs: string[];
    startedAt: string;
    finishedAt: string | null;
    outputPath: string | null;
    outputLatestPath: string | null;
    stats: BidComparisonJobResult | null;
    error: string | null;
    cancelRequested?: boolean;
}

export interface BidComparisonAPI {
    detectInputs: (args: {
        tenderFolderPath: string;
        suppliers: BidComparisonSupplierOption[];
    }) => Promise<BidComparisonDetectionResult>;
    start: (input: BidComparisonStartInput) => Promise<BidComparisonStartResult>;
    get: (jobId: string) => Promise<BidComparisonJobStatus | null>;
    list: (filter?: { projectId?: string; categoryId?: string }) => Promise<BidComparisonJobStatus[]>;
    cancel: (jobId: string) => Promise<{ success: boolean }>;
    autoStart: (config: BidComparisonAutoConfig) => Promise<BidComparisonAutoStartResult>;
    autoStop: (scope: BidComparisonAutoScope) => Promise<{ success: boolean }>;
    autoStatus: (scope: BidComparisonAutoScope) => Promise<BidComparisonAutoStatus | null>;
    autoList: () => Promise<BidComparisonAutoStatus[]>;
}

export interface UpdateStatus {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: {
        version: string;
        releaseDate?: string;
        releaseNotes?: string;
    };
    progress?: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
    };
    error?: string;
}

// File system types
export interface FolderInfo {
    path: string;
    name: string;
}

export interface FileInfo {
    relativePath: string;
    absolutePath: string;
    name: string;
    size: number;
    mtimeMs: number;
    isDirectory: boolean;
    extension: string;
}

// Watcher types
export interface FolderSnapshot {
    folderPath: string;
    timestamp: number;
    files: SnapshotFile[];
}

export interface SnapshotFile {
    relativePath: string;
    size: number;
    mtimeMs: number;
    status: 'ok' | 'pending' | 'error';
    hash?: string;
}

// Change detection
export interface FileChange {
    type: 'added' | 'modified' | 'deleted';
    file: FileInfo;
}
