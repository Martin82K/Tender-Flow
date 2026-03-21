export interface DesktopWindowWebPreferences {
    preload: string;
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    webSecurity: boolean;
}

export const buildMainWindowWebPreferences = (preloadPath: string): DesktopWindowWebPreferences => ({
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
});
