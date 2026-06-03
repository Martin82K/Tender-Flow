import { app, BrowserWindow, ipcMain, dialog, shell, session, nativeImage, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerIpcHandlers } from './ipc/handlers';
import { getAutoUpdaterService } from './services/autoUpdater';
import { startMcpServer } from './services/mcpServer';
import { buildDesktopCsp, shouldInjectDesktopCsp } from './services/csp';
import { buildMainWindowWebPreferences } from './services/windowSecurity';
import { ipcAuthGuard } from './services/ipcAuthGuard';
import { getDesktopRendererPublicEnv } from './services/publicEnv';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
let mcpServerStop: (() => Promise<void>) | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_BOOTSTRAP_ENV_KEYS = new Set([
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
]);
const PUBLIC_ENV_ARG_PREFIX = '--tender-flow-public-env=';

const loadDesktopEnvFile = (filePath: string): void => {
    if (!fs.existsSync(filePath)) return;

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;

            const separatorIndex = line.indexOf('=');
            if (separatorIndex <= 0) continue;

            const key = line.slice(0, separatorIndex).trim();
            if (!DESKTOP_BOOTSTRAP_ENV_KEYS.has(key)) continue;
            if (!key || process.env[key] !== undefined) continue;

            let value = line.slice(separatorIndex + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            process.env[key] = value;
        }
    } catch (error) {
        console.warn('[Env] Failed to load desktop env file:', path.basename(filePath));
    }
};

const loadDesktopEnv = (): void => {
    const appRoot = path.resolve(__dirname, '../..');
    loadDesktopEnvFile(path.join(appRoot, '.env.local'));
    loadDesktopEnvFile(path.join(appRoot, '.env'));
};

const buildDesktopPublicEnvArgument = (): string => {
    const encoded = encodeURIComponent(JSON.stringify(getDesktopRendererPublicEnv()));
    return `${PUBLIC_ENV_ARG_PREFIX}${encoded}`;
};

loadDesktopEnv();

// Suppress Electron security warnings in dev mode.
// In dev, Vite HMR requires 'unsafe-eval' in CSP which triggers the warning.
// Production builds do NOT include unsafe-eval.
if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
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

const canOpenExternalUrl = (rawUrl: string): boolean => {
    try {
        const parsed = new URL(rawUrl);
        if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false;
        if (parsed.protocol === 'mailto:') return true;
        return ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
};

const configureCachePaths = (): void => {
    const cacheRoot = path.join(app.getPath('temp'), 'tender-flow', 'electron-cache');
    const sessionDataPath = path.join(cacheRoot, 'session-data');
    const diskCachePath = path.join(cacheRoot, 'disk-cache');

    try {
        fs.mkdirSync(sessionDataPath, { recursive: true });
        fs.mkdirSync(diskCachePath, { recursive: true });

        app.setPath('sessionData', sessionDataPath);
        app.commandLine.appendSwitch('disk-cache-dir', diskCachePath);
        app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
    } catch (error) {
        console.warn('[Cache] Failed to configure custom cache paths:', error);
    }
};

configureCachePaths();

if (isDev) {
    app.commandLine.appendSwitch('disable-http-cache');
}

function createWindow(): void {
    // Configure session to allow Supabase API calls
    const defaultSession = session.defaultSession;

    // Set CSP for desktop renderer (stricter in production)
    defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!shouldInjectDesktopCsp(details.url, isDev)) {
            callback({
                responseHeaders: details.responseHeaders,
            });
            return;
        }

        const csp = buildDesktopCsp(isDev);
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp]
            }
        });
    });

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        icon: (() => {
            const iconPath = path.join(__dirname, process.platform === 'darwin' ? '../../assets/icon.icns' : '../../assets/icon.ico');
            try {
                const icon = nativeImage.createFromPath(iconPath);
                return icon.isEmpty() ? undefined : icon;
            } catch {
                return undefined;
            }
        })(),
        webPreferences: buildMainWindowWebPreferences(path.join(__dirname, 'preload.js'), [
            buildDesktopPublicEnvArgument(),
        ]),
        titleBarStyle: 'hiddenInset', // macOS native feel
        trafficLightPosition: { x: 15, y: 15 },
        show: false, // Show when ready
        backgroundColor: '#0f172a', // Match app dark theme
    });

    // Initial theme source — will be updated from renderer once useTheme resolves.
    // Defaults to 'dark' to match the app's dark backgroundColor and avoid a light flash.
    nativeTheme.themeSource = 'dark';


    // Set dock icon on macOS
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, '../../assets/icon.icns');
        try {
            const icon = nativeImage.createFromPath(iconPath);
            if (!icon.isEmpty()) {
                app.dock?.setIcon(icon);
            } else {
                console.warn('Dock icon loaded but is empty:', iconPath);
            }
        } catch (error) {
            console.error('Dock icon not accessible:', error);
        }
    }

    // Show window when ready to prevent flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Load the app
    if (isDev) {
        // Development: load from Vite dev server
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        // Production: load from built files
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (canOpenExternalUrl(url)) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Register main window with IPC auth guard
    ipcAuthGuard.setMainWindow(mainWindow);

    mainWindow.on('closed', () => {
        ipcAuthGuard.setAuthenticated(false);
        mainWindow = null;
    });

    // Initialize auto-updater and set main window
    const autoUpdater = getAutoUpdaterService();
    autoUpdater.setMainWindow(mainWindow);

    // Check for updates after window is ready (production only)
    if (!isDev) {
        setTimeout(() => {
            autoUpdater.checkForUpdates();
            // Start periodic checks after initial check
            autoUpdater.startPeriodicChecks();
        }, 5000);
    }
}

// Register IPC handlers
registerIpcHandlers();

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    startMcpServer()
        .then(({ sseUrl, close }) => {
            mcpServerStop = close;
            console.log(`[MCP] Server running at ${sseUrl}`);
        })
        .catch((error) => {
            console.error('[MCP] Failed to start server:', error);
        });

    app.on('activate', () => {
        // macOS: re-create window when clicking dock icon
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // macOS: keep app running until Cmd+Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (mcpServerStop) {
        await mcpServerStop();
        mcpServerStop = null;
    }
});

// Security: prevent navigation away from the app
app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, url) => {
        // Allow mailto links to open in default mail client
        if (url.startsWith('mailto:')) {
            event.preventDefault();
            if (canOpenExternalUrl(url)) {
                shell.openExternal(url);
            }
            return;
        }

        const appUrl = isDev ? 'http://localhost:3000' : 'file://';
        if (!url.startsWith(appUrl)) {
            event.preventDefault();
        }
    });
});

// Export for potential testing
export { mainWindow };
