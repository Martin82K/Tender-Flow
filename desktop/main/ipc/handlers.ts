import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FolderWatcherService } from '../services/folderWatcher';
import { SecureStorageService } from '../services/secureStorage';
import type { FolderInfo, FileInfo } from '../types';

// Services (singleton instances)
let watcherService: FolderWatcherService | null = null;
const storageService = new SecureStorageService();

// Ignore patterns for file listing
const IGNORE_PATTERNS = [
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    '.git',
    'node_modules',
    /^~\$/, // Excel temp files
    /\.tmp$/,
    /\.temp$/,
];

function shouldIgnore(filename: string): boolean {
    return IGNORE_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') return filename === pattern;
        return pattern.test(filename);
    });
}

export function registerIpcHandlers(): void {
    // --- FILE SYSTEM ---

    ipcMain.handle('fs:selectFolder', async (): Promise<FolderInfo | null> => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Vybrat složku pro synchronizaci',
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        const folderPath = result.filePaths[0];
        return {
            path: folderPath,
            name: path.basename(folderPath),
        };
    });

    ipcMain.handle('fs:listFiles', async (_, folderPath: string): Promise<FileInfo[]> => {
        const files: FileInfo[] = [];

        async function scanDirectory(dir: string, relativeTo: string): Promise<void> {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (shouldIgnore(entry.name)) continue;

                const absolutePath = path.join(dir, entry.name);
                const relativePath = path.relative(relativeTo, absolutePath);

                if (entry.isDirectory()) {
                    files.push({
                        relativePath,
                        absolutePath,
                        name: entry.name,
                        size: 0,
                        mtimeMs: 0,
                        isDirectory: true,
                        extension: '',
                    });
                    await scanDirectory(absolutePath, relativeTo);
                } else {
                    const stats = await fs.stat(absolutePath);
                    files.push({
                        relativePath,
                        absolutePath,
                        name: entry.name,
                        size: stats.size,
                        mtimeMs: stats.mtimeMs,
                        isDirectory: false,
                        extension: path.extname(entry.name).toLowerCase(),
                    });
                }
            }
        }

        await scanDirectory(folderPath, folderPath);
        return files;
    });

    ipcMain.handle('fs:readFile', async (_, filePath: string): Promise<Buffer> => {
        return await fs.readFile(filePath);
    });

    ipcMain.handle('fs:writeFile', async (_, filePath: string, data: Buffer | string): Promise<void> => {
        await fs.writeFile(filePath, data);
    });

    ipcMain.handle('fs:openInExplorer', async (_, targetPath: string): Promise<void> => {
        shell.showItemInFolder(targetPath);
    });

    ipcMain.handle('fs:openFile', async (_, filePath: string): Promise<void> => {
        await shell.openPath(filePath);
    });

    ipcMain.handle('fs:createFolder', async (_, folderPath: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await fs.mkdir(folderPath, { recursive: true });
            return { success: true };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    ipcMain.handle('fs:deleteFolder', async (_, folderPath: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await fs.rm(folderPath, { recursive: true, force: true });
            return { success: true };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    ipcMain.handle('fs:folderExists', async (_, folderPath: string): Promise<boolean> => {
        try {
            const stat = await fs.stat(folderPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    });

    // --- WATCHER ---

    ipcMain.handle('watcher:start', async (event, folderPath: string): Promise<void> => {
        if (watcherService) {
            await watcherService.stop();
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        watcherService = new FolderWatcherService(folderPath, (eventType, filePath) => {
            win?.webContents.send('watcher:fileChange', eventType, filePath);
        });

        await watcherService.start();
    });

    ipcMain.handle('watcher:stop', async (): Promise<void> => {
        if (watcherService) {
            await watcherService.stop();
            watcherService = null;
        }
    });

    ipcMain.handle('watcher:getSnapshot', async () => {
        return watcherService?.getSnapshot() ?? null;
    });

    // --- APP ---

    ipcMain.handle('app:getVersion', async (): Promise<string> => {
        return app.getVersion();
    });

    ipcMain.handle('app:checkForUpdates', async (): Promise<boolean> => {
        // TODO: Implement auto-updater
        return false;
    });

    ipcMain.handle('app:quitAndInstall', async (): Promise<void> => {
        // TODO: Implement auto-updater
    });

    ipcMain.handle('app:quit', async (): Promise<void> => {
        app.quit();
    });

    ipcMain.handle('app:getUserDataPath', async (): Promise<string> => {
        return app.getPath('userData');
    });

    // --- STORAGE ---

    ipcMain.handle('storage:get', async (_, key: string): Promise<string | null> => {
        return await storageService.get(key);
    });

    ipcMain.handle('storage:set', async (_, key: string, value: string): Promise<void> => {
        await storageService.set(key, value);
    });

    ipcMain.handle('storage:delete', async (_, key: string): Promise<void> => {
        await storageService.delete(key);
    });

    // --- DIALOG ---

    ipcMain.handle('dialog:showMessage', async (_, options: { type?: string; title?: string; message: string; buttons?: string[] }): Promise<number> => {
        const result = await dialog.showMessageBox({
            type: (options.type as 'none' | 'info' | 'error' | 'question' | 'warning') || 'info',
            title: options.title || 'Tender Flow',
            message: options.message,
            buttons: options.buttons || ['OK'],
        });
        return result.response;
    });

    ipcMain.handle('dialog:showError', async (_, title: string, content: string): Promise<void> => {
        dialog.showErrorBox(title, content);
    });

    // --- PYTHON TOOLS ---

    ipcMain.handle('python:isAvailable', async (): Promise<{ available: boolean; version?: string }> => {
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().isPythonAvailable();
    });

    ipcMain.handle('python:checkDependencies', async (): Promise<{ installed: boolean; missing: string[] }> => {
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().checkDependencies();
    });

    ipcMain.handle('python:runTool', async (_, options: { tool: string; inputFile: string; outputFile?: string }): Promise<{
        success: boolean;
        output?: string;
        error?: string;
        outputFile?: string;
    }> => {
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().runTool(options as any);
    });

    ipcMain.handle('python:mergeExcel', async (_, inputFile: string, outputFile?: string): Promise<{
        success: boolean;
        output?: string;
        error?: string;
        outputFile?: string;
    }> => {
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().mergeExcel(inputFile, outputFile);
    });

    // --- BIOMETRIC AUTH ---

    ipcMain.handle('biometric:isAvailable', async (): Promise<boolean> => {
        const { getBiometricAuthService } = await import('../services/biometricAuth');
        return getBiometricAuthService().isAvailable();
    });

    ipcMain.handle('biometric:prompt', async (_, reason: string): Promise<boolean> => {
        const { getBiometricAuthService } = await import('../services/biometricAuth');
        return getBiometricAuthService().prompt(reason);
    });

    // --- SESSION CREDENTIALS ---

    const SESSION_CREDENTIALS_KEY = 'session_credentials';
    const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

    ipcMain.handle('session:saveCredentials', async (_, credentials: { refreshToken: string; email: string }): Promise<void> => {
        await storageService.set(SESSION_CREDENTIALS_KEY, JSON.stringify(credentials));
    });

    ipcMain.handle('session:getCredentials', async (): Promise<{ refreshToken: string; email: string } | null> => {
        const data = await storageService.get(SESSION_CREDENTIALS_KEY);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    });

    ipcMain.handle('session:clearCredentials', async (): Promise<void> => {
        await storageService.delete(SESSION_CREDENTIALS_KEY);
    });

    ipcMain.handle('session:setBiometricEnabled', async (_, enabled: boolean): Promise<void> => {
        await storageService.set(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    });

    ipcMain.handle('session:isBiometricEnabled', async (): Promise<boolean> => {
        const value = await storageService.get(BIOMETRIC_ENABLED_KEY);
        return value === 'true';
    });

    // --- NETWORK PROXY (Bypass CORS) ---

    // Note: RequestInit types from DOM need to be loosely typed or imported from node-fetch if used
    // But since we are receiving serialized JSON, we can treat it as any
    ipcMain.handle('net:request', async (_, url: string, options?: any) => {
        try {
            console.log(`[Proxy] Fetching ${url} (Main Process) via electron.net.fetch`);

            // Debug headers presence
            if (options?.headers) {
                const hasAuth = !!options.headers.Authorization;
                const hasKey = !!options.headers.apikey;
                console.log(`[Proxy] Request Headers Check - Auth: ${hasAuth}, Key: ${hasKey}`);
                if (hasKey) console.log(`[Proxy] Key prefix: ${options.headers.apikey.substring(0, 5)}...`);
            }

            // Use electron.net.fetch instead of Node's native fetch to use Chromium's network stack
            // This handles system proxies, SSL, etc. better and bypasses CORS
            const { net } = require('electron');
            const response = await net.fetch(url, options);
            const text = await response.text();

            console.log(`[Proxy] Response: ${response.status} ${response.statusText}`);

            // Convert Headers to plain object
            const headers: Record<string, string> = {};
            // @ts-ignore - Headers iterator might slightly differ in types
            response.headers.forEach((val, key) => {
                headers[key] = val;
            });

            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                text,
                headers
            };
        } catch (error: any) {
            console.error(`[Proxy] Error fetching ${url}:`, error);
            console.error(`[Proxy] Error Details:`, {
                message: error.message,
                code: error.code,
                cause: error.cause,
                stack: error.stack
            });
            throw error;
        }
    });
}
