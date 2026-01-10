import React, { useState, useEffect } from 'react';
import { platformAdapter, isDesktop } from '../../services/platformAdapter';
import { Sparkles, FolderOpen, Zap, Shield, ArrowRight, X } from 'lucide-react';

interface WhatsNewItem {
    icon: React.ReactNode;
    title: string;
    description: string;
}

interface DesktopWelcomeProps {
    onClose: () => void;
    onSelectFolder?: () => void;
}

/**
 * Desktop Welcome Screen
 * Shows after app launch with "What's New" and quick actions
 */
export function DesktopWelcome({ onClose, onSelectFolder }: DesktopWelcomeProps) {
    const [appVersion, setAppVersion] = useState<string>('');

    useEffect(() => {
        if (isDesktop) {
            platformAdapter.app.getVersion().then(setAppVersion);
        }
    }, []);

    const whatsNew: WhatsNewItem[] = [
        {
            icon: <FolderOpen className="w-6 h-6 text-blue-400" />,
            title: 'Přímý přístup k složkám',
            description: 'Pracujte přímo s OneDrive/SharePoint složkami bez nutnosti MCP serveru.',
        },
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" />,
            title: 'Rychlejší zpracování',
            description: 'Lokální nástroje pro Excel a PDF běží přímo na vašem počítači.',
        },
        {
            icon: <Shield className="w-6 h-6 text-green-400" />,
            title: 'Bezpečné uložení',
            description: 'Přihlašovací údaje jsou šifrovány systémovým úložištěm.',
        },
    ];

    // Only render on desktop
    if (!isDesktop) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
                        aria-label="Zavřít"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        Vítejte v Tender Flow Desktop
                    </h1>

                    {appVersion && (
                        <p className="text-blue-100 text-sm">
                            Verze {appVersion}
                        </p>
                    )}
                </div>

                {/* What's New */}
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-slate-200 mb-4">
                        Co je nového
                    </h2>

                    <div className="space-y-4">
                        {whatsNew.map((item, index) => (
                            <div key={index} className="flex items-start gap-4 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                <div className="flex-shrink-0 p-2 bg-slate-700 rounded-lg">
                                    {item.icon}
                                </div>
                                <div>
                                    <h3 className="font-medium text-slate-200">{item.title}</h3>
                                    <p className="text-sm text-slate-400 mt-0.5">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    {onSelectFolder && (
                        <button
                            onClick={onSelectFolder}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <FolderOpen className="w-5 h-5" />
                            Připojit složku
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors"
                    >
                        Pokračovat
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DesktopWelcome;
