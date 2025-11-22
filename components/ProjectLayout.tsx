
import React from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { PROJECTS_DB, INITIAL_BIDS } from '../data';
import { ProjectTab } from '../types';

// --- Helper Functions (Reused from Dashboard for single project view) ---
const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;
    const cleanStr = valueStr.replace(/[^0-9,.]/g, '').replace(',', '.');
    let val = parseFloat(cleanStr);
    if (valueStr.includes('M')) val *= 1000000;
    else if (valueStr.includes('k') || valueStr.includes('K')) val *= 1000;
    return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M Kč';
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

// --- Sub-Components ---

const ProjectOverview: React.FC<{ projectId: string }> = ({ projectId }) => {
    const project = PROJECTS_DB[projectId];
    
    // Calculate stats
    let totalBudget = 0;
    let totalContracted = 0;
    let completedTasks = 0;
    
    project.categories.forEach(cat => {
        totalBudget += parseMoney(cat.budget);
        const bids = INITIAL_BIDS[cat.id] || [];
        const winningBid = bids.find(b => b.status === 'sod');
        if (winningBid) {
            totalContracted += parseMoney(winningBid.price || '0');
            completedTasks++;
        }
    });

    const balance = totalBudget - totalContracted;
    const progress = project.categories.length > 0 ? (completedTasks / project.categories.length) * 100 : 0;

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Celkový Rozpočet</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatMoney(totalBudget)}</h3>
                    <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-400 h-full" style={{width: '100%'}}></div>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Zasmluvněno (SOD)</p>
                    <div className="flex justify-between items-end mt-2">
                        <h3 className="text-2xl font-bold text-primary">{formatMoney(totalContracted)}</h3>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full mb-1 ${balance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {balance >= 0 ? 'Úspora' : 'Nad rámec'}
                        </span>
                    </div>
                     <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-primary h-full" style={{width: `${totalBudget > 0 ? (totalContracted/totalBudget)*100 : 0}%`}}></div>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Postup Zadávání</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{completedTasks} / {project.categories.length} <span className="text-sm font-normal text-slate-500">sekcí</span></h3>
                    <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full" style={{width: `${progress}%`}}></div>
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                    <h3 className="font-bold text-lg mb-4">Informace o stavbě</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-slate-400">location_on</span>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Lokace</p>
                                <p className="text-sm text-slate-500">Praha, Česká Republika</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Termín dokončení</p>
                                <p className="text-sm text-slate-500">Prosinec 2025</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-slate-400">person</span>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Hlavní stavbyvedoucí</p>
                                <p className="text-sm text-slate-500">Ing. Karel Novotný</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity (Mock) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                    <h3 className="font-bold text-lg mb-4">Poslední aktivita</h3>
                    <div className="flex flex-col gap-4">
                        {[1,2,3].map(i => (
                            <div key={i} className="flex gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                                <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[20px]">history</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">Změna statusu u poptávky "Elektroinstalace"</p>
                                    <p className="text-xs text-slate-500">Jan Novák • Před 2 hodinami</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProjectDocuments: React.FC = () => {
    const folders = [
        { name: 'Stavební povolení', items: 3 },
        { name: 'Prováděcí dokumentace', items: 12 },
        { name: 'Smlouvy', items: 5 },
        { name: 'Faktury', items: 24 },
        { name: 'Fotodokumentace', items: 156 },
    ];

    return (
        <div className="p-6 lg:p-10 overflow-y-auto">
             <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {folders.map((folder, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                        <span className="material-symbols-outlined text-[40px] text-amber-400 group-hover:scale-110 transition-transform">folder</span>
                        <h3 className="font-bold text-slate-900 dark:text-white mt-2">{folder.name}</h3>
                        <p className="text-xs text-slate-500">{folder.items} souborů</p>
                    </div>
                ))}
                 <button className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                    <span className="material-symbols-outlined text-[30px] mb-2">cloud_upload</span>
                    <span className="text-sm font-medium">Nahrát soubor</span>
                </button>
             </div>
             
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-4">Nedávné soubory</h3>
             <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                 <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                     <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500">
                         <tr>
                             <th className="px-6 py-3">Název</th>
                             <th className="px-6 py-3">Velikost</th>
                             <th className="px-6 py-3">Nahrál</th>
                             <th className="px-6 py-3 text-right">Akce</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         <tr>
                             <td className="px-6 py-4 flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                                 <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                                 Půdorys_1NP_final.pdf
                             </td>
                             <td className="px-6 py-4">4.2 MB</td>
                             <td className="px-6 py-4">Jan Novák</td>
                             <td className="px-6 py-4 text-right">
                                 <button className="hover:text-primary"><span className="material-symbols-outlined">download</span></button>
                             </td>
                         </tr>
                         <tr>
                             <td className="px-6 py-4 flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                                 <span className="material-symbols-outlined text-blue-500">description</span>
                                 Smlouva_Elektro.docx
                             </td>
                             <td className="px-6 py-4">1.8 MB</td>
                             <td className="px-6 py-4">Petr Dvořák</td>
                             <td className="px-6 py-4 text-right">
                                 <button className="hover:text-primary"><span className="material-symbols-outlined">download</span></button>
                             </td>
                         </tr>
                     </tbody>
                 </table>
             </div>
        </div>
    );
};

// --- Main Layout Component ---

interface ProjectLayoutProps {
    projectId: string;
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({ projectId, activeTab, onTabChange }) => {
    const project = PROJECTS_DB[projectId];
    
    if (!project) return <div>Project not found</div>;

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            <Header title={project.title} subtitle="Detail stavby">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button 
                        onClick={() => onTabChange('overview')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Přehled
                    </button>
                    <button 
                        onClick={() => onTabChange('pipeline')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'pipeline' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Pipelines
                    </button>
                    <button 
                        onClick={() => onTabChange('documents')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Dokumentace
                    </button>
                </div>
            </Header>

            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'overview' && <ProjectOverview projectId={projectId} />}
                {activeTab === 'pipeline' && <Pipeline projectId={projectId} />}
                {activeTab === 'documents' && <ProjectDocuments />}
            </div>
        </div>
    );
};
