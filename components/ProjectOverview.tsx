import React from 'react';
import { Header } from './Header';

export const ProjectOverview: React.FC = () => {
    return (
        <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <Header title="Přehled staveb" subtitle="Detailní analýza projektů" />

            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-violet-400 text-[48px]">
                            construction
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                        Připravujeme pro vás
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Detailní přehled staveb s grafy, statistikami a AI analýzou bude dostupný v příští verzi aplikace.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 text-violet-400 rounded-xl text-sm font-medium border border-violet-500/20">
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                        Očekávaně v Q1 2026
                    </div>
                </div>
            </div>
        </div>
    );
};
