import React, { useState, useEffect } from 'react';
import { platformAdapter, isDesktop } from '../../services/platformAdapter';
import { Sparkles, FolderOpen, Zap, Shield, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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
            icon: <FolderOpen className="w-5 h-5 text-blue-500" />,
            title: 'Přímý přístup k složkám',
            description: 'Pracujte přímo s OneDrive/SharePoint složkami bez nutnosti MCP serveru.',
        },
        {
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            title: 'Rychlejší zpracování',
            description: 'Lokální nástroje pro Excel a PDF běží přímo na vašem počítači.',
        },
        {
            icon: <Shield className="w-5 h-5 text-emerald-500" />,
            title: 'Bezpečné uložení',
            description: 'Vaše data a hesla zůstávají v bezpečí vašeho zařízení.',
        },
    ];

    // Only render on desktop
    if (!isDesktop) {
        return null;
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            className="p-0 overflow-hidden"
        >
            <div className="flex flex-col relative w-full">
                {/* Header Section with Gradient Background */}
                <div className="relative bg-gradient-to-br from-indigo-50 to-blue-50 p-8 pt-10 text-center border-b border-blue-100/50">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />

                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm mb-5 mx-auto ring-4 ring-white/50">
                        <Sparkles className="w-8 h-8 text-indigo-500" />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        Vítejte v Tender Flow
                    </h1>

                    <p className="text-slate-600 max-w-md mx-auto">
                        Vaše nová desktopová aplikace je připravena k použití.
                    </p>

                    {appVersion && (
                        <div className="mt-4 inline-flex items-center justify-center px-3 py-1 bg-white/60 rounded-full text-xs font-medium text-slate-500">
                            Verze {appVersion}
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="p-8 bg-white space-y-8">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 px-1">
                            Co je nového
                        </h2>

                        <div className="grid gap-4">
                            {whatsNew.map((item, index) => (
                                <div
                                    key={index}
                                    className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-100 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-200"
                                >
                                    <div className="flex-shrink-0 p-2.5 bg-white rounded-lg shadow-sm ring-1 ring-slate-100 group-hover:scale-110 transition-transform duration-200">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                                        <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        {onSelectFolder && (
                            <Button
                                onClick={onSelectFolder}
                                variant="secondary"
                                size="lg"
                                leftIcon={<FolderOpen className="w-5 h-5" />}
                                className="flex-1 justify-center border-slate-200"
                            >
                                Připojit složku
                            </Button>
                        )}

                        <Button
                            onClick={onClose}
                            variant="primary"
                            size="lg"
                            rightIcon={<ArrowRight className="w-5 h-5" />}
                            className="flex-1 justify-center shadow-blue-500/25 shadow-lg hover:shadow-blue-500/40"
                        >
                            Začít pracovat
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default DesktopWelcome;
