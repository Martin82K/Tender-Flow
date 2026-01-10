import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { FolderSnapshot, SnapshotFile, FileChange, FileInfo } from '../types';

// Ignore patterns for watcher
const IGNORE_PATTERNS = [
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    '.git',
    'node_modules',
    /^~\$/,
    /\.tmp$/,
    /\.temp$/,
];

function shouldIgnore(filename: string): boolean {
    return IGNORE_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') return filename === pattern;
        return pattern.test(filename);
    });
}

type ChangeCallback = (event: string, filePath: string) => void;

export class FolderWatcherService {
    private folderPath: string;
    private onChangeCallback: ChangeCallback;
    private watcher: ReturnType<typeof import('fs').watch> | null = null;
    private snapshot: FolderSnapshot | null = null;
    private rescanInterval: NodeJS.Timeout | null = null;

    private static readonly RESCAN_INTERVAL_MS = 60000; // 60 seconds

    constructor(folderPath: string, onChange: ChangeCallback) {
        this.folderPath = folderPath;
        this.onChangeCallback = onChange;
    }

    async start(): Promise<void> {
        // Create initial snapshot
        await this.createSnapshot();

        // Start native watcher
        const { watch } = await import('fs');
        this.watcher = watch(this.folderPath, { recursive: true }, async (eventType, filename) => {
            if (filename && !shouldIgnore(filename)) {
                await this.handleChange(eventType, filename);
            }
        });

        this.watcher.on('error', (error) => {
            console.error('Watcher error:', error);
        });

        // Periodic rescan as backup
        this.rescanInterval = setInterval(async () => {
            await this.rescan();
        }, FolderWatcherService.RESCAN_INTERVAL_MS);
    }

    async stop(): Promise<void> {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        if (this.rescanInterval) {
            clearInterval(this.rescanInterval);
            this.rescanInterval = null;
        }

        // Save snapshot before stopping
        if (this.snapshot) {
            await this.saveSnapshotToDisk();
        }
    }

    getSnapshot(): FolderSnapshot | null {
        return this.snapshot;
    }

    private async handleChange(eventType: string, filename: string): Promise<void> {
        const fullPath = path.join(this.folderPath, filename);

        try {
            const exists = await fs.access(fullPath).then(() => true).catch(() => false);

            if (!exists) {
                // File was deleted
                this.onChangeCallback('deleted', fullPath);
                this.removeFromSnapshot(filename);
            } else {
                // File was added or modified
                const stats = await fs.stat(fullPath);
                const existingFile = this.snapshot?.files.find(f => f.relativePath === filename);

                if (!existingFile) {
                    this.onChangeCallback('added', fullPath);
                } else if (existingFile.mtimeMs !== stats.mtimeMs || existingFile.size !== stats.size) {
                    this.onChangeCallback('modified', fullPath);
                }

                this.updateSnapshot(filename, stats.size, stats.mtimeMs);
            }
        } catch (error) {
            console.error('Error handling change:', error);
        }
    }

    private async createSnapshot(): Promise<void> {
        const files: SnapshotFile[] = [];

        async function scanDir(dir: string, relativeTo: string): Promise<void> {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (shouldIgnore(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(relativeTo, fullPath);

                if (entry.isDirectory()) {
                    await scanDir(fullPath, relativeTo);
                } else {
                    const stats = await fs.stat(fullPath);
                    files.push({
                        relativePath,
                        size: stats.size,
                        mtimeMs: stats.mtimeMs,
                        status: 'ok',
                    });
                }
            }
        }

        await scanDir(this.folderPath, this.folderPath);

        this.snapshot = {
            folderPath: this.folderPath,
            timestamp: Date.now(),
            files,
        };
    }

    private updateSnapshot(relativePath: string, size: number, mtimeMs: number): void {
        if (!this.snapshot) return;

        const existing = this.snapshot.files.find(f => f.relativePath === relativePath);
        if (existing) {
            existing.size = size;
            existing.mtimeMs = mtimeMs;
        } else {
            this.snapshot.files.push({ relativePath, size, mtimeMs, status: 'ok' });
        }
        this.snapshot.timestamp = Date.now();
    }

    private removeFromSnapshot(relativePath: string): void {
        if (!this.snapshot) return;
        this.snapshot.files = this.snapshot.files.filter(f => f.relativePath !== relativePath);
        this.snapshot.timestamp = Date.now();
    }

    private async rescan(): Promise<void> {
        const previousSnapshot = this.snapshot;
        await this.createSnapshot();

        if (!previousSnapshot || !this.snapshot) return;

        // Detect changes
        const changes = this.detectChanges(previousSnapshot, this.snapshot);

        for (const change of changes) {
            const fullPath = path.join(this.folderPath, change.relativePath);
            this.onChangeCallback(change.type, fullPath);
        }
    }

    private detectChanges(previous: FolderSnapshot, current: FolderSnapshot): Array<{ type: string; relativePath: string }> {
        const changes: Array<{ type: string; relativePath: string }> = [];
        const previousMap = new Map(previous.files.map(f => [f.relativePath, f]));
        const currentMap = new Map(current.files.map(f => [f.relativePath, f]));

        // Check for added and modified
        for (const [relativePath, file] of currentMap) {
            const prev = previousMap.get(relativePath);
            if (!prev) {
                changes.push({ type: 'added', relativePath });
            } else if (prev.mtimeMs !== file.mtimeMs || prev.size !== file.size) {
                changes.push({ type: 'modified', relativePath });
            }
        }

        // Check for deleted
        for (const [relativePath] of previousMap) {
            if (!currentMap.has(relativePath)) {
                changes.push({ type: 'deleted', relativePath });
            }
        }

        return changes;
    }

    private async saveSnapshotToDisk(): Promise<void> {
        if (!this.snapshot) return;

        const userDataPath = app.getPath('userData');
        const snapshotPath = path.join(userDataPath, 'folder-snapshot.json');

        await fs.writeFile(snapshotPath, JSON.stringify(this.snapshot, null, 2), 'utf-8');
    }
}
