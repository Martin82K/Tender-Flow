import React from 'react';
import { HardDrive, Cloud, Wifi, WifiOff, FolderSync } from 'lucide-react';
import { useDesktopConnection } from '../../hooks/useDesktopConnection';

interface FileSystemIndicatorProps {
    showLabel?: boolean;
    className?: string;
}

/**
 * Visual indicator showing how file system operations are connected
 * - Desktop mode: Native file access (green)
 * - MCP mode: Bridge server connected (blue)
 * - None: No file system access (gray)
 */
export function FileSystemIndicator({ showLabel = true, className = '' }: FileSystemIndicatorProps) {
    const { fsStatus, isWatching, watchedFolder } = useDesktopConnection();

    const getStatusConfig = () => {
        switch (fsStatus.mode) {
            case 'desktop':
                return {
                    icon: HardDrive,
                    color: 'text-green-400',
                    bgColor: 'bg-green-500/20',
                    label: 'Desktop',
                    tooltip: 'Přímý přístup k souborům',
                };
            case 'mcp':
                return {
                    icon: Cloud,
                    color: 'text-blue-400',
                    bgColor: 'bg-blue-500/20',
                    label: 'MCP Bridge',
                    tooltip: 'Připojeno přes MCP server',
                };
            default:
                return {
                    icon: WifiOff,
                    color: 'text-slate-500',
                    bgColor: 'bg-slate-500/20',
                    label: 'Nepřipojeno',
                    tooltip: 'Není dostupný přístup k souborům',
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div
            className={`flex items-center gap-2 ${className}`}
            title={config.tooltip}
        >
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                {showLabel && (
                    <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                    </span>
                )}

                {/* Watching indicator */}
                {isWatching && (
                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/20">
                        <FolderSync className="w-3 h-3 text-yellow-400 animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConnectionStatusBadgeProps {
    compact?: boolean;
}

/**
 * Compact badge showing connection status
 */
export function ConnectionStatusBadge({ compact = false }: ConnectionStatusBadgeProps) {
    const { fsStatus } = useDesktopConnection();

    if (!fsStatus.available) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <WifiOff className="w-3 h-3" />
                {!compact && 'Offline'}
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1 text-xs ${fsStatus.mode === 'desktop' ? 'text-green-400' : 'text-blue-400'
            }`}>
            <Wifi className="w-3 h-3" />
            {!compact && (fsStatus.mode === 'desktop' ? 'Desktop' : 'MCP')}
        </span>
    );
}

export default FileSystemIndicator;
