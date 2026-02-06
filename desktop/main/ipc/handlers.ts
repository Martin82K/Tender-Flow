import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import { FolderWatcherService } from '../services/folderWatcher';
import { SecureStorageService } from '../services/secureStorage';
import { getMcpStatus, setMcpAuthToken, setMcpCurrentProjectId } from '../services/mcpServer';
import type { FolderInfo, FileInfo } from '../types';

// Services (singleton instances)
let watcherService: FolderWatcherService | null = null;
const storageService = new SecureStorageService();

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
        await shell.openPath(targetPath);
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

    ipcMain.handle('fs:renameFolder', async (_, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await fs.rename(oldPath, newPath);
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

    ipcMain.handle('biometric:prompt', async (event, reason: string): Promise<boolean> => {
        const { getBiometricAuthService } = await import('../services/biometricAuth');
        const win = BrowserWindow.fromWebContents(event.sender);
        const windowHandle = win?.getNativeWindowHandle();
        return getBiometricAuthService().prompt(reason, windowHandle);
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

    // --- MCP CONTEXT ---

    ipcMain.handle('mcp:setCurrentProject', async (_event, projectId: string | null): Promise<void> => {
        setMcpCurrentProjectId(projectId || null);
    });

    ipcMain.handle('mcp:setAuthToken', async (_event, token: string | null): Promise<void> => {
        setMcpAuthToken(token || null);
    });

    ipcMain.handle('mcp:getStatus', async (): Promise<{
        port: number | null;
        sseUrl: string | null;
        currentProjectId: string | null;
        hasAuthToken: boolean;
        isConfigured: boolean;
    }> => {
        return getMcpStatus();
    });

    // --- OAUTH (Google Desktop) ---

    ipcMain.handle('oauth:googleLogin', async (_event, args: { clientId: string; clientSecret?: string; scopes: string[] }) => {
        const clientId = (args?.clientId || '').trim();
        const clientSecret = (args?.clientSecret || '').trim();
        if (!clientId) {
            throw new Error('Missing Google OAuth clientId');
        }
        const scopes = Array.isArray(args?.scopes) && args.scopes.length > 0
            ? args.scopes
            : ['https://www.googleapis.com/auth/drive.file'];

        const codeVerifier = createCodeVerifier();
        const codeChallenge = createCodeChallenge(codeVerifier);
        const { port, waitForCode } = await startLoopbackServer(120_000);
        const redirectUri = `http://127.0.0.1:${port}/oauth2/callback`;
        const state = crypto.randomUUID();

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scopes.join(' '));
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('include_granted_scopes', 'true');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('state', state);

        const parsedAuthUrl = parseUrl(authUrl.toString());
        if (!isAllowedExternalUrl(parsedAuthUrl)) {
            throw new Error('Blocked OAuth URL host');
        }
        await shell.openExternal(parsedAuthUrl.toString());
        const { code, state: returnedState } = await waitForCode;
        if (returnedState !== state) {
            throw new Error('Invalid OAuth state');
        }

        const body = new URLSearchParams();
        body.set('code', code);
        body.set('client_id', clientId);
        if (clientSecret) {
            body.set('client_secret', clientSecret);
        }
        body.set('code_verifier', codeVerifier);
        body.set('redirect_uri', redirectUri);
        body.set('grant_type', 'authorization_code');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        });
        const tokenJson = await tokenRes.json() as any;
        if (!tokenRes.ok) {
            throw new Error(tokenJson?.error_description || 'Google token exchange failed');
        }

        return {
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token || null,
            expiresIn: tokenJson.expires_in,
            scope: tokenJson.scope || null,
            tokenType: tokenJson.token_type,
            idToken: tokenJson.id_token || null,
        };
    });

    // --- NETWORK PROXY (Bypass CORS) ---

    // Note: RequestInit types from DOM need to be loosely typed or imported from node-fetch if used
    // But since we are receiving serialized JSON, we can treat it as any
    ipcMain.handle('net:request', async (_, url: string, options?: any) => {
        try {
            const parsedUrl = new URL(url);
            if (!isAllowedProxyUrl(parsedUrl)) {
                throw new Error(`Proxy target not allowed: ${parsedUrl.hostname}`);
            }

            console.log(`[Proxy] Fetching ${parsedUrl.origin} (Main Process) via electron.net.fetch`);

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
            const response = await net.fetch(parsedUrl.toString(), options);
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
            console.error(`[Proxy] Error fetching URL via proxy:`, error);
            console.error(`[Proxy] Error Details:`, {
                message: error.message,
                code: error.code,
                cause: error.cause,
                stack: error.stack
            });
            throw error;
        }
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
