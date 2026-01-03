import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Button } from './ui/Button';
import { Project, ProjectDetails } from '../types';
import { ProjectOverviewNew } from './ProjectOverviewNew';
import * as XLSX from 'xlsx';

interface DashboardProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
    onUpdateProjectDetails?: (id: string, updates: Partial<ProjectDetails>) => void;
    onNavigateToProject?: (projectId: string, tab: string, categoryId?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, projectDetails, onUpdateProjectDetails, onNavigateToProject }) => {
    const activeProjects = projects.filter(p => p.status !== 'archived');

    // Load last selected project from localStorage or use first active
    const getInitialProjectId = () => {
        const saved = localStorage.getItem('dashboardSelectedProject');
        if (saved && activeProjects.some(p => p.id === saved)) {
            return saved;
        }
        return activeProjects[0]?.id || '';
    };

    const [selectedProjectId, setSelectedProjectId] = useState<string>(getInitialProjectId);

    // Save to localStorage when project changes
    React.useEffect(() => {
        if (selectedProjectId) {
            localStorage.setItem('dashboardSelectedProject', selectedProjectId);
        }
    }, [selectedProjectId]);

    const selectedProject = projectDetails[selectedProjectId];

    // Helper for Export (duplicated logic for now to preserve functionality without rendering)
    const handleExport = () => {
        if (!selectedProject) return;

        // Re-calculate metrics for export (simplified version of what was in Dashboard)
        const categories = selectedProject.categories || [];
        // const sodCategories = categories.filter(c => c.status === 'sod'); // Unused

        const getCategoryBidInfo = (categoryId: string) => {
            const bids = selectedProject.bids?.[categoryId] || [];
            const winners = bids.filter(b => b.status === 'sod');
            const winnersTotal = winners.reduce((sum, w) => {
                const price = typeof w.price === 'string'
                    ? parseFloat(w.price.replace(/[^\d.,-]/g, '').replace(',', '.'))
                    : 0;
                return sum + (isNaN(price) ? 0 : price);
            }, 0);
            return {
                totalBids: bids.length,
                withPrice: bids.filter(b => b.price).length,
                winnersTotal,
                winnersNames: winners.map(w => w.companyName).join(', ')
            };
        };

        const data = [...categories].sort((a, b) => a.title.localeCompare(b.title, 'cs')).map(cat => {
            const bidInfo = getCategoryBidInfo(cat.id);
            const sodVr = bidInfo.winnersTotal > 0 ? (cat.sodBudget || 0) - bidInfo.winnersTotal : null;
            const pnVr = bidInfo.winnersTotal > 0 ? (cat.planBudget || 0) - bidInfo.winnersTotal : null;

            return {
                'Stav': cat.status === 'sod' ? 'SOD' : cat.status === 'open' ? 'Probíhá' : cat.status === 'closed' ? 'Ukončeno' : cat.status,
                'Poptávka': cat.title,
                'SOD (Kč)': cat.sodBudget || 0,
                'Plán (Kč)': cat.planBudget || 0,
                'Cena VŘ (Kč)': bidInfo.winnersTotal || '-',
                'SOD-VŘ (Kč)': sodVr !== null ? sodVr : '-',
                'PN-VŘ (Kč)': pnVr !== null ? pnVr : '-',
                'Nabídky': `${bidInfo.withPrice}/${bidInfo.totalBids}`,
                'Vítěz': bidInfo.winnersNames || '-'
            };
        });

        // Totals
        const totalSodAll = categories.reduce((sum, c) => sum + (c.sodBudget || 0), 0);
        const totalPlanned = categories.reduce((sum, c) => sum + (c.planBudget || 0), 0);
        const totalCenaVr = categories.reduce((sum, cat) => sum + getCategoryBidInfo(cat.id).winnersTotal, 0);

        data.push({
            'Stav': '',
            'Poptávka': 'CELKEM',
            'SOD (Kč)': totalSodAll,
            'Plán (Kč)': totalPlanned,
            'Cena VŘ (Kč)': totalCenaVr || '-',
            'SOD-VŘ (Kč)': '-', // Simplified for total
            'PN-VŘ (Kč)': '-',
            'Nabídky': '',
            'Vítěz': ''
        } as any);

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Poptávky');
        ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }];
        XLSX.writeFile(wb, `prehled-${selectedProject.title.replace(/\s+/g, '-')}.xlsx`);
    };

    if (activeProjects.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
                <Header title="Dashboard" subtitle="Detailní přehled projektu" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-slate-400 dark:text-slate-600 text-[80px] mb-4 block">domain_disabled</span>
                        <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400">Žádné aktivní projekty</h3>
                        <p className="text-slate-500 mt-2">Přidejte projekt ve Správě staveb</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <Header title="Dashboard" subtitle="Detailní přehled projektu">
                <div className="flex items-center gap-3">
                    {/* Project Selector */}
                    <div className="relative">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2.5 pr-10 rounded-xl text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[220px]"
                        >
                            {activeProjects.map(project => (
                                <option key={project.id} value={project.id}>
                                    {projectDetails[project.id]?.title || project.name}
                                </option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                    </div>

                    {/* Export Button */}
                    <Button
                        variant="success"
                        onClick={handleExport}
                        leftIcon={<span className="material-symbols-outlined text-[18px]">download</span>}
                        className="rounded-xl"
                    >
                        Export XLSX
                    </Button>
                </div>
            </Header>

            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
                {selectedProject ? (
                    <ProjectOverviewNew
                        project={selectedProject}
                        onUpdate={(updates) => onUpdateProjectDetails?.(selectedProjectId, updates)}
                        variant="compact"
                        onNavigateToPipeline={(categoryId) => onNavigateToProject?.(selectedProjectId, 'pipeline', categoryId)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Načítám data projektu...
                    </div>
                )}
            </div>
        </div>
    );
};
