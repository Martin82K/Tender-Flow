import { useState, useEffect, useCallback } from 'react';
import { isDesktop, watcherAdapter, type UpdateStatusInfo, updaterAdapter } from '../services/platformAdapter';
import { checkFileSystemStatus, type FileSystemStatus } from '../services/fileSystemService';

export interface DesktopConnectionState {
    isDesktop: boolean;
    fsStatus: FileSystemStatus;
    isWatching: boolean;
    watchedFolder: string | null;
}

/**
 * Hook for managing desktop-specific connection state
 * Provides unified status for file system access (desktop native or MCP)
 */
export function useDesktopConnection() {
    const [state, setState] = useState<DesktopConnectionState>({
        isDesktop,
        fsStatus: { available: false, mode: 'none' },
        isWatching: false,
        watchedFolder: null,
    });

    // Check file system status on mount and periodically
    useEffect(() => {
        const checkStatus = async () => {
            const status = await checkFileSystemStatus();
            setState(prev => ({ ...prev, fsStatus: status }));
        };

        checkStatus();

        // Re-check every 30 seconds
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const startWatching = useCallback(async (folderPath: string) => {
        if (!isDesktop) return;

        try {
            await watcherAdapter.start(folderPath);
            setState(prev => ({
                ...prev,
                isWatching: true,
                watchedFolder: folderPath,
            }));
        } catch (error) {
            console.error('Failed to start watching:', error);
        }
    }, []);

    const stopWatching = useCallback(async () => {
        if (!isDesktop) return;

        try {
            await watcherAdapter.stop();
            setState(prev => ({
                ...prev,
                isWatching: false,
                watchedFolder: null,
            }));
        } catch (error) {
            console.error('Failed to stop watching:', error);
        }
    }, []);

    return {
        ...state,
        startWatching,
        stopWatching,
    };
}

export default useDesktopConnection;
