interface SingleInstanceWindow {
    isMinimized(): boolean;
    restore(): void;
    focus(): void;
}

interface SingleInstanceApp {
    requestSingleInstanceLock(): boolean;
    quit(): void;
    on(event: 'second-instance', listener: () => void): unknown;
}

export const configureSingleInstance = (
    electronApp: SingleInstanceApp,
    getMainWindow: () => SingleInstanceWindow | null,
): boolean => {
    const hasLock = electronApp.requestSingleInstanceLock();
    if (!hasLock) {
        electronApp.quit();
        return false;
    }

    electronApp.on('second-instance', () => {
        const window = getMainWindow();
        if (!window) return;

        if (window.isMinimized()) {
            window.restore();
        }
        window.focus();
    });

    return true;
};
