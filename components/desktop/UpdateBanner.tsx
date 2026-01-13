import React from 'react';
import { Monitor } from 'lucide-react';
import { UpdateNotification, useElectronUpdater } from '../UpdateNotification';

/**
 * Update notification banner for desktop app
 * Shows when an update is available, downloading, or downloaded
 */
export function UpdateBanner() {
    const {
        status,
        info,
        progress,
        error,
        downloadUpdate,
        installUpdate,
    } = useElectronUpdater();

    return (
        <UpdateNotification
            status={status}
            info={info}
            progress={progress}
            error={error}
            onDownload={downloadUpdate}
            onInstall={installUpdate}
            onDismiss={() => {
                // Update notification will handle hiding itself
            }}
        />
    );
}

interface DesktopIndicatorProps {
    appVersion: string | null;
}

/**
 * Small indicator showing this is the desktop version
 */
export function DesktopIndicator({ appVersion }: DesktopIndicatorProps) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 bg-slate-800/50 rounded-full">
            <Monitor className="w-3 h-3" />
            <span>Desktop{appVersion ? ` v${appVersion}` : ''}</span>
        </div>
    );
}

export default { UpdateBanner, DesktopIndicator };
