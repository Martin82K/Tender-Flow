import React from 'react';
import { Download, Check, RefreshCw, Monitor } from 'lucide-react';

interface UpdateBannerProps {
    isVisible: boolean;
    isCheckingUpdate: boolean;
    onCheckUpdate: () => void;
    onInstallUpdate: () => void;
}

/**
 * Update notification banner for desktop app
 * Shows when an update is available
 */
export function UpdateBanner({
    isVisible,
    isCheckingUpdate,
    onCheckUpdate,
    onInstallUpdate
}: UpdateBannerProps) {
    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-2xl p-4 max-w-sm border border-white/20">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
                        <Download className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white">
                            Nová verze k dispozici
                        </h3>
                        <p className="text-sm text-blue-100 mt-0.5">
                            K dispozici je aktualizace aplikace.
                        </p>

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={onInstallUpdate}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-600 font-medium text-sm rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                <Check className="w-4 h-4" />
                                Aktualizovat
                            </button>

                            <button
                                onClick={onCheckUpdate}
                                disabled={isCheckingUpdate}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white font-medium text-sm rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                                {isCheckingUpdate ? 'Kontroluji...' : 'Zkontrolovat'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
