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
import { registerNotificationHandlers } from './modules/notificationHandlers';
import { registerBackupHandlers } from './modules/backupHandlers';
import { getAutoUpdaterService } from '../services/autoUpdater';
import { convertToDocx } from './modules/docxConversion';
import { ipcAuthGuard } from '../services/ipcAuthGuard';

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

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
const ALLOWED_EXTERNAL_HOSTS = new Set([
    'accounts.google.com',
    'oauth2.googleapis.com',
    'api.github.com',
    'github.com',
    'www.github.com',
    'tenderflow.cz',
    'www.tenderflow.cz',
    'ares.gov.cz',
    'www.rzp.cz',
    'rzp.gov.cz',
    'or.justice.cz',
]);

const ALLOWED_PROXY_HOST_SUFFIXES = ['.supabase.co', '.supabase.in'];
const ALLOWED_PROXY_HOSTS = new Set([
    'gw.sandbox.gopay.com',
    'gate.gopay.cz',
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
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname);
    }
    return false;
};

const isAllowedProxyUrl = (parsed: URL): boolean => {
    if (parsed.protocol !== 'https:') return false;
    if (ALLOWED_PROXY_HOSTS.has(parsed.hostname)) return true;
    return ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix));
};

const sanitizeTempFilename = (fileName: string, fallback = 'document.tmp'): string => {
    const baseName = path.basename(fileName || fallback);
    const cleaned = baseName
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return cleaned || fallback;
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

export function registerIpcHandlers(mainWindow?: BrowserWindow): void {
    if (mainWindow) {
        ipcAuthGuard.setMainWindow(mainWindow);
    }

    // Auth state management: renderer notifies main process on login/logout
    ipcMain.handle('auth:setAuthenticated', async (event, authenticated: boolean): Promise<void> => {
        if (!ipcAuthGuard.isTrustedSender(event.sender)) {
            throw new Error('IPC_AUTH_DENIED: untrusted sender for auth:setAuthenticated');
        }
        ipcAuthGuard.setAuthenticated(!!authenticated);
    });

    const requireAuth = (sender: Electron.WebContents, channel?: string): void => {
        ipcAuthGuard.requireAuth(sender, channel);
    };

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

    registerFsHandlers({ resolvePortableReadPath, resolvePortableWritePath, requireAuth });
    registerWatcherHandlers({ resolvePortableReadPath, requireAuth });
    registerBidComparisonHandlers({ resolvePortableReadPath, bidComparisonAutoRunner, requireAuth });
    registerSessionHandlers({ storageService, requireAuth });
    registerMcpHandlers({ requireAuth });
    registerOAuthHandlers({
        parseUrl,
        isAllowedExternalUrl,
        createCodeVerifier,
        createCodeChallenge,
        startLoopbackServer,
        requireAuth,
    });
    registerNetHandlers({ isAllowedProxyUrl, requireAuth });
    registerNotificationHandlers();
    registerBackupHandlers({ requireAuth });

    // --- APP ---

    ipcMain.handle('app:getVersion', async (): Promise<string> => {
        return app.getVersion();
    });

    ipcMain.handle('app:checkForUpdates', async (): Promise<boolean> => {
        return getAutoUpdaterService().checkForUpdates();
    });

    ipcMain.handle('app:quitAndInstall', async (): Promise<void> => {
        getAutoUpdaterService().quitAndInstall();
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

    // --- STORAGE (auth required) ---

    ipcMain.handle('storage:get', async (event, key: string): Promise<string | null> => {
        requireAuth(event.sender, 'storage:get');
        return await storageService.get(key);
    });

    ipcMain.handle('storage:set', async (event, key: string, value: string): Promise<void> => {
        requireAuth(event.sender, 'storage:set');
        await storageService.set(key, value);
    });

    ipcMain.handle('storage:delete', async (event, key: string): Promise<void> => {
        requireAuth(event.sender, 'storage:delete');
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

    // --- PYTHON TOOLS (auth required) ---

    ipcMain.handle('python:isAvailable', async (event): Promise<{ available: boolean; version?: string }> => {
        requireAuth(event.sender, 'python:isAvailable');
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().isPythonAvailable();
    });

    ipcMain.handle('python:checkDependencies', async (event): Promise<{ installed: boolean; missing: string[] }> => {
        requireAuth(event.sender, 'python:checkDependencies');
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().checkDependencies();
    });

    ipcMain.handle('python:runTool', async (event, options: { tool: string; inputFile: string; outputFile?: string }): Promise<{
        success: boolean;
        output?: string;
        error?: string;
        outputFile?: string;
    }> => {
        requireAuth(event.sender, 'python:runTool');
        const { getPythonRunner } = await import('../services/pythonRunner');
        return getPythonRunner().runTool(options as any);
    });

    ipcMain.handle('python:mergeExcel', async (event, inputFile: string, outputFile?: string): Promise<{
        success: boolean;
        output?: string;
        error?: string;
        outputFile?: string;
    }> => {
        requireAuth(event.sender, 'python:mergeExcel');
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

    // --- SHELL (auth required) ---

    ipcMain.handle('shell:openExternal', async (event, url: string): Promise<void> => {
        requireAuth(event.sender, 'shell:openExternal');
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

    ipcMain.handle('shell:openTempFile', async (event, content: string, filename: string): Promise<void> => {
        requireAuth(event.sender, 'shell:openTempFile');
        console.log('[Shell] openTempFile called:', filename);
        const os = require('os');
        const tempDir = os.tmpdir();
        const safeFileName = sanitizeTempFilename(filename, 'document.txt');
        const tempPath = path.join(tempDir, safeFileName);

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

    ipcMain.handle('shell:openTempBinaryFile', async (event, base64Content: string, filename: string): Promise<void> => {
        requireAuth(event.sender, 'shell:openTempBinaryFile');
        console.log('[Shell] openTempBinaryFile called:', filename);
        const os = require('os');
        const tempDir = os.tmpdir();
        const safeFileName = sanitizeTempFilename(filename, 'document.bin');
        const tempPath = path.join(tempDir, safeFileName);

        try {
            const binaryBuffer = Buffer.from(base64Content, 'base64');
            await fs.writeFile(tempPath, binaryBuffer);
            console.log('[Shell] Wrote temp binary file:', tempPath);
            await shell.openPath(tempPath);
            console.log('[Shell] Opened temp binary file successfully');
        } catch (error) {
            console.error('[Shell] openTempBinaryFile failed:', error);
            throw error;
        }
    });

    ipcMain.handle('shell:convertToDocx', async (event, inputPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> => {
        requireAuth(event.sender, 'shell:convertToDocx');
        console.log('[Shell] convertToDocx called for:', inputPath);
        const result = await convertToDocx(inputPath);
        if (result.success) {
            console.log('[Shell] Conversion successful ->', result.outputPath);
        } else {
            console.error('[Shell] Conversion failed:', result.error);
        }
        return result;
    });
}
