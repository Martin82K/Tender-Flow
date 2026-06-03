export interface DesktopWindowWebPreferences {
    preload: string;
    additionalArguments: string[];
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    webSecurity: boolean;
}

export const buildMainWindowWebPreferences = (
    preloadPath: string,
    additionalArguments: string[] = [],
): DesktopWindowWebPreferences => ({
    preload: preloadPath,
    additionalArguments,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
});
