import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { getAutoUpdaterService } from './services/autoUpdater';
import { startMcpServer } from './services/mcpServer';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
let mcpServerStop: (() => Promise<void>) | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        // icon: path.join(__dirname, process.platform === 'darwin' ? '../../assets/icon.icns' : '../../assets/icon.ico'),
        icon: (() => {
            const iconPath = path.join(__dirname, process.platform === 'darwin' ? '../../assets/icon.icns' : '../../assets/icon.ico');
            console.log('Resolving icon path:', iconPath);
            try {
                require('fs').accessSync(iconPath);
                console.log('Icon file exists and is accessible');
                return iconPath;
            } catch (error) {
                console.error('Icon file not accessible:', error);
                return undefined; // Fallback to no icon to prevent crash
            }
        })(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
        titleBarStyle: 'hiddenInset', // macOS native feel
        trafficLightPosition: { x: 15, y: 15 },
        show: false, // Show when ready
        backgroundColor: '#0f172a', // Match app dark theme
    });

    // Set dock icon on macOS
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, '../../assets/icon.icns');
        try {
            require('fs').accessSync(iconPath);
            app.dock.setIcon(iconPath);
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
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Initialize auto-updater and set main window
    const autoUpdater = getAutoUpdaterService();
    autoUpdater.setMainWindow(mainWindow);

    // Check for updates after window is ready (production only)
    if (!isDev) {
        setTimeout(() => {
            autoUpdater.checkForUpdates();
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
            shell.openExternal(url);
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
