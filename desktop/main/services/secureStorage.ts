import { safeStorage } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * Secure storage service using Electron's safeStorage API
 * Encrypts sensitive data at rest using OS-level encryption
 */
export class SecureStorageService {
    private storagePath: string;
    private cache: Map<string, string> = new Map();

    constructor() {
        const userDataPath = app.getPath('userData');
        this.storagePath = path.join(userDataPath, 'secure-storage.json');
    }

    async get(key: string): Promise<string | null> {
        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key) || null;
        }

        const data = await this.loadStorage();
        const encryptedValue = data[key];

        if (!encryptedValue) return null;

        // Decrypt if safeStorage is available
        if (safeStorage.isEncryptionAvailable()) {
            try {
                const buffer = Buffer.from(encryptedValue, 'base64');
                const decrypted = safeStorage.decryptString(buffer);
                this.cache.set(key, decrypted);
                return decrypted;
            } catch (error) {
                console.error('Failed to decrypt value:', error);
                return null;
            }
        }

        // Fallback: return as-is (not encrypted)
        return encryptedValue;
    }

    async set(key: string, value: string): Promise<void> {
        const data = await this.loadStorage();

        // Encrypt if safeStorage is available
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(value);
            data[key] = encrypted.toString('base64');
        } else {
            // Fallback: store as-is (development mode)
            data[key] = value;
        }

        this.cache.set(key, value);
        await this.saveStorage(data);
    }

    async delete(key: string): Promise<void> {
        const data = await this.loadStorage();
        delete data[key];
        this.cache.delete(key);
        await this.saveStorage(data);
    }

    private async loadStorage(): Promise<Record<string, string>> {
        try {
            const content = await fs.readFile(this.storagePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            // File doesn't exist or is invalid
            return {};
        }
    }

    private async saveStorage(data: Record<string, string>): Promise<void> {
        await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
    }
}
