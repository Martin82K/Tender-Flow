import { useState, useEffect, useCallback } from 'react';
import { isDesktop, platformAdapter } from '../services/platformAdapter';

interface DesktopState {
    isDesktop: boolean;
    appVersion: string | null;
    showWelcome: boolean;
    updateAvailable: boolean;
    isCheckingUpdate: boolean;
}

interface UseDesktopReturn extends DesktopState {
    dismissWelcome: () => void;
    checkForUpdates: () => Promise<void>;
    installUpdate: () => Promise<void>;
    selectFolder: () => Promise<{ path: string; name: string } | null>;
}

const WELCOME_DISMISSED_KEY = 'desktop_welcome_dismissed_version';

/**
 * Hook for managing desktop-specific features
 * Handles welcome screen, updates, and folder selection
 */
export function useDesktop(): UseDesktopReturn {
    const [state, setState] = useState<DesktopState>({
        isDesktop,
        appVersion: null,
        showWelcome: false,
        updateAvailable: false,
        isCheckingUpdate: false,
    });

    // Load app version and check if welcome should be shown
    useEffect(() => {
        if (!isDesktop) return;

        const init = async () => {
            const version = await platformAdapter.app.getVersion();

            // Check if user has dismissed welcome for this version
            const dismissedVersion = await platformAdapter.storage.get(WELCOME_DISMISSED_KEY);
            const shouldShowWelcome = dismissedVersion !== version;

            setState(prev => ({
                ...prev,
                appVersion: version,
                showWelcome: shouldShowWelcome,
            }));

            // Auto-check for updates on startup (after 3 seconds)
            setTimeout(async () => {
                const hasUpdate = await platformAdapter.app.checkForUpdates();
                setState(prev => ({ ...prev, updateAvailable: hasUpdate }));
            }, 3000);
        };

        init();
    }, []);

    const dismissWelcome = useCallback(async () => {
        if (state.appVersion) {
            await platformAdapter.storage.set(WELCOME_DISMISSED_KEY, state.appVersion);
        }
        setState(prev => ({ ...prev, showWelcome: false }));
    }, [state.appVersion]);

    const checkForUpdates = useCallback(async () => {
        if (!isDesktop) return;

        setState(prev => ({ ...prev, isCheckingUpdate: true }));
        try {
            const hasUpdate = await platformAdapter.app.checkForUpdates();
            setState(prev => ({
                ...prev,
                updateAvailable: hasUpdate,
                isCheckingUpdate: false,
            }));
        } catch (error) {
            console.error('Failed to check for updates:', error);
            setState(prev => ({ ...prev, isCheckingUpdate: false }));
        }
    }, []);

    const installUpdate = useCallback(async () => {
        if (!isDesktop) return;
        // This will quit the app and install the update
        // In future, integrate with electron-updater
        await platformAdapter.dialog.showMessage({
            type: 'info',
            title: 'Aktualizace',
            message: 'Aktualizace bude nainstalována při příštím spuštění aplikace.',
        });
    }, []);

    const selectFolder = useCallback(async () => {
        if (!isDesktop) return null;
        return platformAdapter.fs.selectFolder();
    }, []);

    return {
        ...state,
        dismissWelcome,
        checkForUpdates,
        installUpdate,
        selectFolder,
    };
}

export default useDesktop;
