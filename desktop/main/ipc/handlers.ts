import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import { SecureStorageService } from '../services/secureStorage';
import { getBidComparisonAutoRunner } from '../services/bidComparisonAutoRunner';
import { resolvePortablePath } from '../services/portablePathResolver';
import { registerBidComparisonHandlers } from './modules/bidComparisonHandlers';
import { registerFsHandlers } from './modules/fsHandlers';
import { registerMcpHandlers } from './modules/mcpHandlers';
import { registerNetHandlers } from './modules/netHandlers';
import { registerOAuthHandlers } from './modules/oauthHandlers';
import { registerSessionHandlers } from './modules/sessionHandlers';
import { registerWatcherHandlers } from './modules/watcherHandlers';

// Services (singleton instances)
const storageService = new SecureStorageService();
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const base64UrlEncode = (input: Buffer | Uint8Array): string => {
    const b64 = Buffer.from(input).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const createCodeVerifier = (): string => base64UrlEncode(crypto.randomBytes(32));

const createCodeChallenge = (verifier: string): string =>
    base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
const ALLOWED_EXTERNAL_HOSTS = new Set([
    'accounts.google.com',
    'oauth2.googleapis.com',
    'api.github.com',
    'github.com',
    'www.github.com',
    'tenderflow.cz',
    'www.tenderflow.cz',
]);

const ALLOWED_PROXY_HOST_SUFFIXES = ['.supabase.co', '.supabase.in'];
const ALLOWED_PROXY_HOSTS = new Set([
    'api.stripe.com',
    'oauth2.googleapis.com',
    'accounts.google.com',
]);

const parseUrl = (rawUrl: string): URL => {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }

    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        throw new Error(`Blocked protocol: ${parsed.protocol}`);
    }
    return parsed;
};

const isAllowedExternalUrl = (parsed: URL): boolean => {
    if (parsed.protocol === 'mailto:') return true;
    return ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname);
};

const isAllowedProxyUrl = (parsed: URL): boolean => {
    if (parsed.protocol !== 'https:') return false;
    if (ALLOWED_PROXY_HOSTS.has(parsed.hostname)) return true;
    return ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix));
};

const startLoopbackServer = (timeoutMs: number) => {
    return new Promise<{
        port: number;
        waitForCode: Promise<{ code: string; state: string | null }>;
    }>((resolve, reject) => {
        let resolvedPort = 0;
        let timer: NodeJS.Timeout | null = null;
        let resolveCode: ((value: { code: string; state: string | null }) => void) | null = null;
        let rejectCode: ((reason?: any) => void) | null = null;

        const waitForCode = new Promise<{ code: string; state: string | null }>((res, rej) => {
            resolveCode = res;
            rejectCode = rej;
        });

        const server = http.createServer((req, res) => {
            const base = resolvedPort ? `http://127.0.0.1:${resolvedPort}` : 'http://127.0.0.1';
            const url = new URL(req.url || '/', base);
            if (url.pathname !== '/oauth2/callback') {
                res.writeHead(404, { 'content-type': 'text/plain' });
                res.end('Not found');
                return;
            }

            const error = url.searchParams.get('error');
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end('<html><body>Ověření dokončeno. Okno můžete zavřít.</body></html>');

            if (timer) clearTimeout(timer);
            server.close();

            if (error) {
                rejectCode?.(new Error(error));
                return;
            }
            if (!code) {
                rejectCode?.(new Error('Missing authorization code'));
                return;
            }
            resolveCode?.({ code, state });
        });

        server.on('error', (err) => {
            if (timer) clearTimeout(timer);
            reject(err);
        });

        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close();
                reject(new Error('Failed to start loopback server'));
                return;
            }
            resolvedPort = address.port;
            timer = setTimeout(() => {
                server.close();
                rejectCode?.(new Error('OAuth timeout'));
            }, timeoutMs);
            resolve({ port: resolvedPort, waitForCode });
        });
    });
};

export function registerIpcHandlers(): void {
    const bidComparisonAutoRunner = getBidComparisonAutoRunner(storageService);
    void bidComparisonAutoRunner.restorePersistedSessions();
    const remapLogCache = new Set<string>();

    const resolvePortableReadPath = async (targetPath: string): Promise<string> =>
        resolvePortablePath(targetPath, {
            mode: 'read',
            homeDir: app.getPath('home'),
            onRemap: ({ from, to, mode }) => {
                const key = `${mode}|${from}|${to}`;
                if (remapLogCache.has(key)) return;
                remapLogCache.add(key);
                console.log(`[PortablePathResolver] ${mode} remap: ${from} -> ${to}`);
            },
        });

    const resolvePortableWritePath = async (targetPath: string): Promise<string> =>
        resolvePortablePath(targetPath, {
            mode: 'write',
            homeDir: app.getPath('home'),
            onRemap: ({ from, to, mode }) => {
                const key = `${mode}|${from}|${to}`;
                if (remapLogCache.has(key)) return;
                remapLogCache.add(key);
                console.log(`[PortablePathResolver] ${mode} remap: ${from} -> ${to}`);
            },
        });

    registerFsHandlers({ resolvePortableReadPath, resolvePortableWritePath });
    registerWatcherHandlers({ resolvePortableReadPath });
    registerBidComparisonHandlers({ resolvePortableReadPath, bidComparisonAutoRunner });
    registerSessionHandlers({ storageService });
    registerMcpHandlers();
    registerOAuthHandlers({
        parseUrl,
        isAllowedExternalUrl,
        createCodeVerifier,
        createCodeChallenge,
        startLoopbackServer,
    });
    registerNetHandlers({ isAllowedProxyUrl });

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

    ipcMain.handle('app:openUserManual', async (event): Promise<void> => {
        const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
        const manualWindow = new BrowserWindow({
            width: 1200,
            height: 860,
            minWidth: 900,
            minHeight: 640,
            parent: parentWindow,
            autoHideMenuBar: true,
            title: 'Tender Flow – Uživatelská příručka',
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
        });

        if (isDev) {
            await manualWindow.loadURL('http://localhost:3000/user-manual/index.html');
            return;
        }

        const manualPath = path.join(app.getAppPath(), 'dist', 'user-manual', 'index.html');
        await manualWindow.loadFile(manualPath);
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

    ipcMain.handle('biometric:prompt', async (event, reason: string): Promise<boolean> => {
        const { getBiometricAuthService } = await import('../services/biometricAuth');
        const win = BrowserWindow.fromWebContents(event.sender);
        const windowHandle = win?.getNativeWindowHandle();
        return getBiometricAuthService().prompt(reason, windowHandle);
    });

    // --- SHELL ---

    ipcMain.handle('shell:openExternal', async (_, url: string): Promise<void> => {
        try {
            const parsedUrl = parseUrl(url);
            if (!isAllowedExternalUrl(parsedUrl)) {
                throw new Error(`Blocked external URL host: ${parsedUrl.hostname}`);
            }
            await shell.openExternal(parsedUrl.toString());
            console.log('[Shell] openExternal completed successfully');
        } catch (error) {
            console.error('[Shell] openExternal failed:', error);
            throw error;
        }
    });

    ipcMain.handle('shell:openTempFile', async (_, content: string, filename: string): Promise<void> => {
        console.log('[Shell] openTempFile called:', filename);
        const os = require('os');
        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, filename);

        try {
            await fs.writeFile(tempPath, content, 'utf-8');
            console.log('[Shell] Wrote temp file:', tempPath);
            await shell.openPath(tempPath);
            console.log('[Shell] Opened temp file successfully');
        } catch (error) {
            console.error('[Shell] openTempFile failed:', error);
            throw error;
        }
    });

    ipcMain.handle('shell:convertToDocx', async (_, inputPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> => {
        console.log('[Shell] convertToDocx called for:', inputPath);
        
        if (process.platform !== 'darwin') {
            return { success: false, error: 'Conversion is only supported on macOS' };
        }

        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        const os = require('os');
        const path = require('path');

        try {
            // Generate temp output path
            const tempDir = os.tmpdir();
            const filename = path.basename(inputPath, path.extname(inputPath)); // strip .doc
            const outputPath = path.join(tempDir, `${filename}_${Date.now()}.docx`);

            // Use macOS textutil
            // textutil -convert docx source.doc -output target.docx
            const command = `textutil -convert docx "${inputPath}" -output "${outputPath}"`;
            console.log('[Shell] Running command:', command);

            await execAsync(command);
            
            // Verify file exists
            await fs.access(outputPath);
            console.log('[Shell] Conversion successful ->', outputPath);

            return { success: true, outputPath };
        } catch (error) {
            console.error('[Shell] Conversion failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
}
