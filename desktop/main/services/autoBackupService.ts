import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { SecureStorageService } from './secureStorage';

export interface BackupFileInfo {
    fileName: string;
    filePath: string;
    backupType: 'user' | 'tenant' | 'contacts';
    organizationId: string;
    createdAt: string;
    sizeBytes: number;
}

export interface BackupSettings {
    enabled: boolean;
    backupFolderPath: string;
    lastBackupAt: string | null;
    lastBackupError: string | null;
    scheduledTime: string; // HH:MM in 24h format
}

const BACKUP_DIR_NAME = 'backup';
const MAX_AGE_DAYS = 7;
const SAFE_ORGANIZATION_ID_REGEX = /^[A-Za-z0-9-]+$/;
const ENCRYPTION_KEY_STORAGE_KEY = 'backup_encryption_key';
const ENCRYPTED_MAGIC_PREFIX = 'TFENC1:';
const DEFAULT_SCHEDULED_TIME = '03:00';
const SCHEDULED_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SETTINGS_FILE_NAME = 'backup-settings.json';

/**
 * Auto-backup service for managing local backup files.
 * Stores JSON backup files in {Documents}/Tender Flow/Backups/ so that they
 * survive application updates and uninstalls. Retention is 7 days.
 * Settings (enabled flag, scheduled time, last-run metadata) are persisted to
 * {userData}/backup-settings.json so they survive restarts.
 */
export class AutoBackupService {
    private backupTimeout: NodeJS.Timeout | null = null;
    private backupFolderPath: string;
    private settingsFilePath: string;
    private enabled: boolean = false;
    private lastBackupAt: string | null = null;
    private lastBackupError: string | null = null;
    private scheduledTime: string = DEFAULT_SCHEDULED_TIME;
    private onBackupRequest: (() => Promise<string | null>) | null = null;
    private secureStorage: SecureStorageService;
    private initPromise: Promise<void>;

    constructor() {
        // Documents is stable across installs/updates/uninstalls — backups must not
        // live in the install directory (wiped on update) or in userData (wiped on
        // uninstall on some platforms).
        this.backupFolderPath = path.join(app.getPath('documents'), 'Tender Flow', 'Backups');
        this.settingsFilePath = path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
        this.secureStorage = new SecureStorageService();
        this.initPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await this.loadPersistedSettings();
            await this.ensureBackupFolder();
            await this.migrateLegacyBackupsIfNeeded();
            if (this.enabled) {
                this.scheduleNextBackup();
            }
        } catch (error) {
            console.error('[AutoBackup] Initialization failed:', error);
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
        await this.initPromise;
        return {
            enabled: this.enabled,
            backupFolderPath: this.backupFolderPath,
            lastBackupAt: this.lastBackupAt,
            lastBackupError: this.lastBackupError,
            scheduledTime: this.scheduledTime,
        };
    }

    async setEnabled(enabled: boolean): Promise<void> {
        await this.initPromise;
        this.enabled = enabled;
        if (enabled) {
            await this.ensureBackupFolder();
            this.scheduleNextBackup();
        } else {
            this.stopScheduledBackups();
        }
        await this.persistSettings();
    }

    async setScheduledTime(time: string): Promise<void> {
        await this.initPromise;
        if (!SCHEDULED_TIME_REGEX.test(time)) {
            throw new Error('Neplatný formát času (očekávaný HH:MM)');
        }
        this.scheduledTime = time;
        if (this.enabled) {
            this.scheduleNextBackup();
        }
        await this.persistSettings();
    }

    /**
     * Save a backup JSON string to disk (encrypted with AES-256-GCM).
     */
    async saveBackup(
        jsonContent: string,
        backupType: 'user' | 'tenant' | 'contacts',
        organizationId: string
    ): Promise<string> {
        await this.ensureBackupFolder();
        const safeOrganizationId = this.sanitizeOrganizationId(organizationId);

        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const time = new Date().toISOString().slice(11, 19).replace(/:/g, ''); // HHmmss
        const fileName = `backup-${backupType}-${safeOrganizationId}-${date}-${time}.enc.json`;
        const filePath = this.resolveBackupPath(fileName);

        const encryptedContent = await this.encryptContent(jsonContent);
        await fs.writeFile(filePath, encryptedContent, 'utf-8');

        this.lastBackupAt = new Date().toISOString();
        this.lastBackupError = null;
        await this.persistSettings();

        console.log(`[AutoBackup] Saved encrypted backup: ${fileName} (${encryptedContent.length} bytes)`);

        // Clean old backups after each save
        await this.cleanOldBackups();

        return filePath;
    }

    /**
     * Read a backup file from disk (auto-detects encrypted vs plain).
     */
    async readBackup(filePath: string): Promise<string> {
        const safePath = this.resolveBackupPath(filePath);
        const content = await fs.readFile(safePath, 'utf-8');
        if (content.startsWith(ENCRYPTED_MAGIC_PREFIX)) {
            return this.decryptContent(content);
        }
        // Legacy unencrypted file
        return content;
    }

    /**
     * Get or generate the AES-256 encryption key.
     * Stored in SecureStorageService (OS-protected via Electron safeStorage).
     */
    private async getOrCreateEncryptionKey(): Promise<Buffer> {
        const existing = await this.secureStorage.get(ENCRYPTION_KEY_STORAGE_KEY);
        if (existing) {
            return Buffer.from(existing, 'base64');
        }
        const key = crypto.randomBytes(32);
        await this.secureStorage.set(ENCRYPTION_KEY_STORAGE_KEY, key.toString('base64'));
        console.log('[AutoBackup] Generated new backup encryption key');
        return key;
    }

    /**
     * Encrypt plaintext using AES-256-GCM.
     * Format: "TFENC1:{iv_b64}.{authTag_b64}.{ciphertext_b64}"
     */
    private async encryptContent(plaintext: string): Promise<string> {
        const key = await this.getOrCreateEncryptionKey();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf-8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();

        return `${ENCRYPTED_MAGIC_PREFIX}${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
    }

    /**
     * Decrypt content encrypted by encryptContent().
     */
    private async decryptContent(encryptedStr: string): Promise<string> {
        const payload = encryptedStr.slice(ENCRYPTED_MAGIC_PREFIX.length);
        const [ivB64, authTagB64, dataB64] = payload.split('.', 3);
        if (!ivB64 || !authTagB64 || !dataB64) {
            throw new Error('Neplatný formát šifrované zálohy');
        }

        const key = await this.getOrCreateEncryptionKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataB64, 'base64')),
            decipher.final(),
        ]);

        return decrypted.toString('utf-8');
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
                // Parse: backup-{type}-{orgId}-{date}-{time}[.enc].json
                const baseName = fileName.replace('.enc.json', '.json').replace('.json', '');
                const parts = baseName.split('-');
                const backupType = parts[1] as 'user' | 'tenant' | 'contacts';

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

    private scheduleNextBackup(): void {
        if (this.backupTimeout) {
            clearTimeout(this.backupTimeout);
            this.backupTimeout = null;
        }

        const delayMs = this.computeDelayUntilNextRun();
        const nextRun = new Date(Date.now() + delayMs);
        console.log(`[AutoBackup] Next scheduled backup at ${nextRun.toISOString()} (in ${Math.round(delayMs / 1000)}s)`);

        this.backupTimeout = setTimeout(async () => {
            await this.runScheduledBackup();
            // Chain the next run after completion so timing does not drift.
            if (this.enabled) {
                this.scheduleNextBackup();
            }
        }, delayMs);
    }

    private computeDelayUntilNextRun(): number {
        const [hours, minutes] = this.scheduledTime.split(':').map(Number);
        const now = new Date();
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next.getTime() <= now.getTime()) {
            next.setDate(next.getDate() + 1);
        }
        return next.getTime() - now.getTime();
    }

    private async runScheduledBackup(): Promise<void> {
        if (!this.onBackupRequest) return;
        try {
            console.log('[AutoBackup] Running scheduled backup...');
            const result = await this.onBackupRequest();
            if (result) {
                this.lastBackupAt = new Date().toISOString();
                this.lastBackupError = null;
                await this.persistSettings();
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.lastBackupError = msg;
            await this.persistSettings();
            console.error('[AutoBackup] Scheduled backup failed:', msg);
        }
    }

    private stopScheduledBackups(): void {
        if (this.backupTimeout) {
            clearTimeout(this.backupTimeout);
            this.backupTimeout = null;
            console.log('[AutoBackup] Scheduled backups stopped');
        }
    }

    private async loadPersistedSettings(): Promise<void> {
        try {
            const raw = await fs.readFile(this.settingsFilePath, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<{
                enabled: boolean;
                lastBackupAt: string | null;
                lastBackupError: string | null;
                scheduledTime: string;
            }>;
            if (typeof parsed.enabled === 'boolean') this.enabled = parsed.enabled;
            if (typeof parsed.lastBackupAt === 'string' || parsed.lastBackupAt === null) {
                this.lastBackupAt = parsed.lastBackupAt ?? null;
            }
            if (typeof parsed.lastBackupError === 'string' || parsed.lastBackupError === null) {
                this.lastBackupError = parsed.lastBackupError ?? null;
            }
            if (typeof parsed.scheduledTime === 'string' && SCHEDULED_TIME_REGEX.test(parsed.scheduledTime)) {
                this.scheduledTime = parsed.scheduledTime;
            }
        } catch {
            // Missing or invalid settings file — keep defaults.
        }
    }

    private async persistSettings(): Promise<void> {
        const payload = {
            enabled: this.enabled,
            lastBackupAt: this.lastBackupAt,
            lastBackupError: this.lastBackupError,
            scheduledTime: this.scheduledTime,
        };
        try {
            await fs.mkdir(path.dirname(this.settingsFilePath), { recursive: true });
            await fs.writeFile(this.settingsFilePath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (error) {
            console.error('[AutoBackup] Failed to persist settings:', error);
        }
    }

    /**
     * Move backup files from legacy locations (install dir, userData) into the
     * Documents folder so that previously created backups survive the path change.
     * Only runs when the new folder has no backups yet.
     */
    private async migrateLegacyBackupsIfNeeded(): Promise<void> {
        const legacyPaths = [
            path.join(app.getPath('userData'), BACKUP_DIR_NAME),
            path.join(path.dirname(app.getPath('exe')), BACKUP_DIR_NAME),
        ];

        try {
            const existing = await fs.readdir(this.backupFolderPath);
            const hasBackups = existing.some((f) => f.startsWith('backup-') && f.endsWith('.json'));
            if (hasBackups) return;
        } catch {
            // New folder not yet readable — treat as empty.
        }

        for (const legacyPath of legacyPaths) {
            if (path.resolve(legacyPath) === path.resolve(this.backupFolderPath)) continue;
            try {
                const files = await fs.readdir(legacyPath);
                for (const fileName of files) {
                    if (!fileName.startsWith('backup-') || !fileName.endsWith('.json')) continue;
                    const src = path.join(legacyPath, fileName);
                    const dst = path.join(this.backupFolderPath, fileName);
                    try {
                        await fs.copyFile(src, dst);
                        await fs.unlink(src);
                        console.log(`[AutoBackup] Migrated legacy backup: ${fileName}`);
                    } catch (error) {
                        console.warn(`[AutoBackup] Failed to migrate ${fileName}:`, error);
                    }
                }
            } catch {
                // Legacy folder does not exist — ignore.
            }
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
