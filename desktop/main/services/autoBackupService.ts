import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BackupFileInfo {
    fileName: string;
    filePath: string;
    backupType: 'user' | 'tenant';
    organizationId: string;
    createdAt: string;
    sizeBytes: number;
}

export interface BackupSettings {
    enabled: boolean;
    backupFolderPath: string;
    lastBackupAt: string | null;
    lastBackupError: string | null;
}

const BACKUP_DIR_NAME = 'backup';
const MAX_AGE_DAYS = 7;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SAFE_ORGANIZATION_ID_REGEX = /^[A-Za-z0-9-]+$/;

/**
 * Auto-backup service for managing local backup files.
 * Stores JSON backup files in {installDir}/backup/ with 7-day retention.
 * In dev mode, falls back to {userData}/backup/.
 */
export class AutoBackupService {
    private backupInterval: NodeJS.Timeout | null = null;
    private backupFolderPath: string;
    private enabled: boolean = false;
    private lastBackupAt: string | null = null;
    private lastBackupError: string | null = null;
    private onBackupRequest: (() => Promise<string | null>) | null = null;

    constructor() {
        const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
        if (isDev) {
            // Dev: use userData to avoid polluting the source tree
            this.backupFolderPath = path.join(app.getPath('userData'), BACKUP_DIR_NAME);
        } else {
            // Production: use the installation directory (next to the .exe)
            this.backupFolderPath = path.join(path.dirname(app.getPath('exe')), BACKUP_DIR_NAME);
        }
    }

    /**
     * Set the callback that performs the actual backup (calls Supabase RPC and returns JSON string).
     * This is called by the IPC handler layer which has access to the renderer's auth context.
     */
    setBackupRequestHandler(handler: () => Promise<string | null>): void {
        this.onBackupRequest = handler;
    }

    async getSettings(): Promise<BackupSettings> {
        return {
            enabled: this.enabled,
            backupFolderPath: this.backupFolderPath,
            lastBackupAt: this.lastBackupAt,
            lastBackupError: this.lastBackupError,
        };
    }

    async setEnabled(enabled: boolean): Promise<void> {
        this.enabled = enabled;
        if (enabled) {
            await this.ensureBackupFolder();
            this.startPeriodicBackups();
        } else {
            this.stopPeriodicBackups();
        }
    }

    /**
     * Save a backup JSON string to disk.
     */
    async saveBackup(
        jsonContent: string,
        backupType: 'user' | 'tenant',
        organizationId: string
    ): Promise<string> {
        await this.ensureBackupFolder();
        const safeOrganizationId = this.sanitizeOrganizationId(organizationId);

        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const time = new Date().toISOString().slice(11, 19).replace(/:/g, ''); // HHmmss
        const fileName = `backup-${backupType}-${safeOrganizationId}-${date}-${time}.json`;
        const filePath = this.resolveBackupPath(fileName);

        await fs.writeFile(filePath, jsonContent, 'utf-8');

        this.lastBackupAt = new Date().toISOString();
        this.lastBackupError = null;

        console.log(`[AutoBackup] Saved backup: ${fileName} (${jsonContent.length} bytes)`);

        // Clean old backups after each save
        await this.cleanOldBackups();

        return filePath;
    }

    /**
     * Read a backup file from disk.
     */
    async readBackup(filePath: string): Promise<string> {
        const safePath = this.resolveBackupPath(filePath);
        const content = await fs.readFile(safePath, 'utf-8');
        return content;
    }

    /**
     * List all backup files in the backup folder.
     */
    async listBackups(): Promise<BackupFileInfo[]> {
        await this.ensureBackupFolder();

        const files = await fs.readdir(this.backupFolderPath);
        const backups: BackupFileInfo[] = [];

        for (const fileName of files) {
            if (!fileName.startsWith('backup-') || !fileName.endsWith('.json')) continue;

            const filePath = path.join(this.backupFolderPath, fileName);
            try {
                const stat = await fs.stat(filePath);
                // Parse: backup-{type}-{orgId}-{date}-{time}.json
                const parts = fileName.replace('.json', '').split('-');
                // parts: ['backup', type, orgId..., date parts, time]
                const backupType = parts[1] as 'user' | 'tenant';

                // orgId could contain dashes (UUID), date is YYYY-MM-DD, time is HHmmss
                // Format: backup-user-{uuid}-YYYY-MM-DD-HHmmss.json
                // UUID is 36 chars with dashes
                const rest = parts.slice(2).join('-');
                // UUID is first 36 chars
                const organizationId = rest.slice(0, 36);

                backups.push({
                    fileName,
                    filePath,
                    backupType,
                    organizationId,
                    createdAt: stat.mtime.toISOString(),
                    sizeBytes: stat.size,
                });
            } catch {
                // Skip files that can't be read
            }
        }

        // Sort newest first
        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return backups;
    }

    /**
     * Delete backup files older than MAX_AGE_DAYS.
     */
    async cleanOldBackups(): Promise<number> {
        const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        let deleted = 0;

        try {
            const files = await fs.readdir(this.backupFolderPath);
            for (const fileName of files) {
                if (!fileName.startsWith('backup-') || !fileName.endsWith('.json')) continue;

                const filePath = path.join(this.backupFolderPath, fileName);
                try {
                    const stat = await fs.stat(filePath);
                    if (stat.mtime.getTime() < cutoff) {
                        await fs.unlink(filePath);
                        deleted++;
                        console.log(`[AutoBackup] Deleted old backup: ${fileName}`);
                    }
                } catch {
                    // Skip files that can't be accessed
                }
            }
        } catch {
            // Folder might not exist yet
        }

        return deleted;
    }

    getBackupFolder(): string {
        return this.backupFolderPath;
    }

    private startPeriodicBackups(): void {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }

        console.log('[AutoBackup] Starting periodic backups (every 24h)');
        this.backupInterval = setInterval(async () => {
            if (this.onBackupRequest) {
                try {
                    console.log('[AutoBackup] Running scheduled backup...');
                    const result = await this.onBackupRequest();
                    if (result) {
                        this.lastBackupAt = new Date().toISOString();
                        this.lastBackupError = null;
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error';
                    this.lastBackupError = msg;
                    console.error('[AutoBackup] Scheduled backup failed:', msg);
                }
            }
        }, AUTO_BACKUP_INTERVAL_MS);
    }

    private stopPeriodicBackups(): void {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            console.log('[AutoBackup] Periodic backups stopped');
        }
    }

    private async ensureBackupFolder(): Promise<void> {
        try {
            await fs.mkdir(this.backupFolderPath, { recursive: true });
        } catch {
            // Already exists
        }
    }

    private sanitizeOrganizationId(organizationId: string): string {
        if (!SAFE_ORGANIZATION_ID_REGEX.test(organizationId)) {
            throw new Error('Invalid organization ID');
        }

        return organizationId;
    }

    private resolveBackupPath(inputPath: string): string {
        const backupFolder = path.resolve(this.backupFolderPath);
        const candidatePath = path.isAbsolute(inputPath)
            ? path.resolve(inputPath)
            : path.resolve(backupFolder, inputPath);
        const relativePath = path.relative(backupFolder, candidatePath);
        const isOutsideBackupFolder =
            relativePath.startsWith('..') || path.isAbsolute(relativePath);

        if (isOutsideBackupFolder || path.extname(candidatePath) !== '.json') {
            throw new Error('Invalid backup path');
        }

        return candidatePath;
    }
}

// Singleton
let autoBackupService: AutoBackupService | null = null;

export function getAutoBackupService(): AutoBackupService {
    if (!autoBackupService) {
        autoBackupService = new AutoBackupService();
    }
    return autoBackupService;
}
