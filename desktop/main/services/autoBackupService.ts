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
}

const BACKUP_DIR_NAME = 'backup';
const MAX_AGE_DAYS = 7;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ENCRYPTION_KEY_STORAGE_KEY = 'backup_encryption_key';
const ENCRYPTED_MAGIC_PREFIX = 'TFENC1:';

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
    private secureStorage: SecureStorageService;

    constructor() {
        const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
        if (isDev) {
            // Dev: use userData to avoid polluting the source tree
            this.backupFolderPath = path.join(app.getPath('userData'), BACKUP_DIR_NAME);
        } else {
            // Production: use the installation directory (next to the .exe)
            this.backupFolderPath = path.join(path.dirname(app.getPath('exe')), BACKUP_DIR_NAME);
        }
        this.secureStorage = new SecureStorageService();
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
     * Save a backup JSON string to disk (encrypted with AES-256-GCM).
     */
    async saveBackup(
        jsonContent: string,
        backupType: 'user' | 'tenant' | 'contacts',
        organizationId: string
    ): Promise<string> {
        await this.ensureBackupFolder();

        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const time = new Date().toISOString().slice(11, 19).replace(/:/g, ''); // HHmmss
        const fileName = `backup-${backupType}-${organizationId}-${date}-${time}.enc.json`;
        const filePath = path.join(this.backupFolderPath, fileName);

        const encryptedContent = await this.encryptContent(jsonContent);
        await fs.writeFile(filePath, encryptedContent, 'utf-8');

        this.lastBackupAt = new Date().toISOString();
        this.lastBackupError = null;

        console.log(`[AutoBackup] Saved encrypted backup: ${fileName} (${encryptedContent.length} bytes)`);

        // Clean old backups after each save
        await this.cleanOldBackups();

        return filePath;
    }

    /**
     * Read a backup file from disk (auto-detects encrypted vs plain).
     */
    async readBackup(filePath: string): Promise<string> {
        const content = await fs.readFile(filePath, 'utf-8');
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
}

// Singleton
let autoBackupService: AutoBackupService | null = null;

export function getAutoBackupService(): AutoBackupService {
    if (!autoBackupService) {
        autoBackupService = new AutoBackupService();
    }
    return autoBackupService;
}
