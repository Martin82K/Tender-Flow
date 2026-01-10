import React, { useState, useEffect } from 'react';
import { platformAdapter, isDesktop } from '../../services/platformAdapter';
import { Sparkles, FolderOpen, Zap, Shield, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import appIcon from '../../assets/app_icon_v6_clean.png';

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
            icon: <FolderOpen className="w-5 h-5 text-amber-500" />,
            title: 'Přímý přístup k složkám',
            description: 'Pracujte přímo s lokálními složkami bez nutnosti MCP serveru.',
        },
        {
            icon: <Zap className="w-5 h-5 text-orange-500" />,
            title: 'Rychlejší zpracování',
            description: 'Lokální nástroje pro Excel a PDF běží přímo na vašem počítači.',
        },
        {
            icon: <Shield className="w-5 h-5 text-amber-600" />,
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
            className="p-0 overflow-hidden border border-orange-500/20 shadow-[0_0_50px_-12px_rgba(249,115,22,0.3)] !bg-slate-950"
        >
            <div className="flex flex-col relative w-full bg-slate-950 text-slate-200">
                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                {/* Header Section */}
                <div className="relative p-8 pt-10 text-center border-b border-white/5 z-10">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-[0_0_30px_rgba(249,115,22,0.25)] mb-6 mx-auto ring-1 ring-white/10 group relative transition-transform duration-500 hover:scale-110 hover:rotate-3 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-amber-500/0 rounded-3xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <img
                            src={appIcon}
                            alt="Tender Flow Icon"
                            className="relative w-full h-full object-cover z-10"
                        />
                    </div>


                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        Vítejte v <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">Tender Flow</span>
                    </h1>

                    <p className="text-slate-400 max-w-md mx-auto">
                        Vaše nová desktopová aplikace je připravena k použití.
                    </p>

                    {appVersion && (
                        <div className="mt-4 inline-flex items-center justify-center px-3 py-1 bg-white/5 rounded-full ring-1 ring-white/10 text-xs font-medium text-slate-400">
                            Verze {appVersion}
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="relative p-8 space-y-8 z-10">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-orange-500/80 mb-5 px-1">
                            Co je nového
                        </h2>

                        <div className="grid gap-4">
                            {whatsNew.map((item, index) => (
                                <div
                                    key={index}
                                    className="group flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-orange-500/30 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.15)] transition-all duration-300"
                                >
                                    <div className="flex-shrink-0 p-2.5 bg-slate-900/50 rounded-lg ring-1 ring-white/10 group-hover:ring-orange-500/50 group-hover:scale-110 transition-all duration-300 shadow-inner">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-200 mb-1 group-hover:text-amber-100 transition-colors">{item.title}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            onClick={onClose}
                            variant="primary"
                            size="lg"
                            rightIcon={<ArrowRight className="w-5 h-5" />}
                            className="flex-1 justify-center !bg-gradient-to-r !from-orange-600 !to-amber-600 hover:!from-orange-500 hover:!to-amber-500 !border-0 shadow-[0_0_25px_-5px_rgba(249,115,22,0.4)] hover:shadow-[0_0_35px_-5px_rgba(249,115,22,0.6)] text-white font-semibold tracking-wide transition-all duration-300"
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

