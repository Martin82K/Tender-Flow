import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';

interface UpdateInfo {
    version: string;
    releaseNotes?: string;
    releaseDate?: string;
}

interface UpdateProgress {
    percent: number;
    transferred: number;
    total: number;
}

export type UpdateStatus =
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';

interface UpdateNotificationProps {
    status: UpdateStatus;
    info?: UpdateInfo;
    progress?: UpdateProgress;
    error?: string;
    onDownload: () => void;
    onInstall: () => void;
    onDismiss: () => void;
    onCheckForUpdates?: () => void;
}

export function UpdateNotification({
    status,
    info,
    progress,
    error,
    onDownload,
    onInstall,
    onDismiss,
    onCheckForUpdates,
}: UpdateNotificationProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show notification when update is available or downloaded
        if (status === 'available' || status === 'downloading' || status === 'downloaded') {
            setIsVisible(true);
        }
    }, [status]);

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss();
    };

    if (!isVisible || status === 'not-available' || status === 'checking') {
        return null;
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="fixed bottom-6 right-6 w-96 bg-red-900/90 backdrop-blur-sm border border-red-700 rounded-lg shadow-2xl p-4 z-50 animate-slide-up">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1">
                            Chyba při aktualizaci
                        </h3>
                        <p className="text-sm text-red-200">
                            {error || 'Nepodařilo se zkontrolovat aktualizace'}
                        </p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-red-400 hover:text-red-200 transition-colors"
                        aria-label="Zavřít"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    // Downloaded - ready to install
    if (status === 'downloaded') {
        return (
            <div className="fixed bottom-6 right-6 w-96 bg-gradient-to-br from-green-900/90 to-emerald-900/90 backdrop-blur-sm border border-green-700 rounded-lg shadow-2xl p-5 z-50 animate-slide-up">
                <div className="flex items-start gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-lg mb-1">
                            Aktualizace připravena
                        </h3>
                        <p className="text-sm text-green-100">
                            Verze {info?.version} je stažená a připravená k instalaci
                        </p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-green-400 hover:text-green-200 transition-colors"
                        aria-label="Zavřít"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onInstall}
                        className="flex-1 bg-white hover:bg-green-50 text-green-900 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Nainstalovat a restartovat
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="px-4 py-2.5 rounded-lg border border-green-600 text-green-200 hover:bg-green-800/50 transition-colors"
                    >
                        Později
                    </button>
                </div>
            </div>
        );
    }

    // Downloading
    if (status === 'downloading' && progress) {
        const percentComplete = Math.round(progress.percent);
        const transferredMB = (progress.transferred / 1024 / 1024).toFixed(1);
        const totalMB = (progress.total / 1024 / 1024).toFixed(1);

        return (
            <div className="fixed bottom-6 right-6 w-96 bg-slate-900/90 backdrop-blur-sm border border-blue-700 rounded-lg shadow-2xl p-5 z-50 animate-slide-up">
                <div className="flex items-start gap-3 mb-4">
                    <Download className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-lg mb-1">
                            Stahování aktualizace
                        </h3>
                        <p className="text-sm text-slate-300">
                            Verze {info?.version} • {transferredMB} MB / {totalMB} MB
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-400">
                        <span>Průběh</span>
                        <span>{percentComplete}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300 ease-out"
                            style={{ width: `${percentComplete}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Available - ready to download
    if (status === 'available') {
        return (
            <div className="fixed bottom-6 right-6 w-96 bg-gradient-to-br from-blue-900/90 to-indigo-900/90 backdrop-blur-sm border border-blue-700 rounded-lg shadow-2xl p-5 z-50 animate-slide-up">
                <div className="flex items-start gap-3 mb-4">
                    <Download className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-lg mb-1">
                            Nová verze dostupná
                        </h3>
                        <p className="text-sm text-blue-100 mb-2">
                            Verze {info?.version} je k dispozici
                        </p>
                        {info?.releaseNotes && (
                            <p className="text-xs text-blue-200 line-clamp-2">
                                {info.releaseNotes}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-blue-400 hover:text-blue-200 transition-colors"
                        aria-label="Zavřít"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onDownload}
                        className="flex-1 bg-white hover:bg-blue-50 text-blue-900 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Stáhnout aktualizaci
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="px-4 py-2.5 rounded-lg border border-blue-600 text-blue-200 hover:bg-blue-800/50 transition-colors"
                    >
                        Později
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

// Hook for using the updater in React components
export function useElectronUpdater() {
    const [updateState, setUpdateState] = useState<{
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: UpdateProgress;
        error?: string;
    }>({
        status: 'not-available',
    });

    useEffect(() => {
        // Check if running in Electron
        if (!window.electron?.updater) {
            return;
        }

        // Listen for update status changes
        const unsubscribe = window.electron.updater.onStatusChange((status) => {
            setUpdateState(status);
        });

        // Get initial status
        window.electron.updater.getStatus().then((status) => {
            setUpdateState(status);
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    const checkForUpdates = async () => {
        if (window.electron?.updater) {
            await window.electron.updater.checkForUpdates();
        }
    };

    const downloadUpdate = async () => {
        if (window.electron?.updater) {
            await window.electron.updater.downloadUpdate();
        }
    };

    const installUpdate = () => {
        if (window.electron?.updater) {
            window.electron.updater.quitAndInstall();
        }
    };

    return {
        ...updateState,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
    };
}
