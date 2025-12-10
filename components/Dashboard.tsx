import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Project, ProjectDetails, DemandCategory, Bid } from '../types';
import { formatMoney, formatMoneyShort } from '../utils/formatters';
import { generateProjectInsights, generateLocalInsights, AIInsight } from '../services/aiInsightsService';
import * as XLSX from 'xlsx';

interface DashboardProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
}

// KPI Card Component
const KPICard: React.FC<{ title: string; value: string; icon: string; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => (
    <div className="bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
                <span className="material-symbols-outlined">{icon}</span>
            </div>
        </div>
    </div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const getStatusStyle = () => {
        switch (status) {
            case 'sod': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'open': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'closed': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };
    const getStatusLabel = () => {
        switch (status) {
            case 'sod': return 'SOD';
            case 'open': return 'Probíhá';
            case 'cancelled': return 'Zrušeno';
            case 'closed': return 'Ukončeno';
            default: return status;
        }
    };
    return (
        <span className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${getStatusStyle()}`}>
            {getStatusLabel()}
        </span>
    );
};

// AI Widget Component with cached insights per mode
const AIWidget: React.FC<{ projectData: any }> = ({ projectData }) => {
    const [insightsCache, setInsightsCache] = useState<Record<string, AIInsight[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<'achievements' | 'charts' | 'reports' | 'contacts'>('achievements');

    const insights = insightsCache[mode] || [];

    const generateAnalysis = async (selectedMode?: string, forceRegenerate = false) => {
        if (!projectData) return;
        const modeToUse = selectedMode || mode;

        // Use cache if available and not forcing regenerate
        if (!forceRegenerate && insightsCache[modeToUse]?.length > 0) {
            return;
        }

        setIsLoading(true);
        try {
            const aiInsights = await generateProjectInsights([projectData], modeToUse as any);
            setInsightsCache(prev => ({ ...prev, [modeToUse]: aiInsights }));
        } catch (error) {
            console.error('AI error:', error);
            setInsightsCache(prev => ({ ...prev, [modeToUse]: generateLocalInsights([projectData]) }));
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-load on first render
    React.useEffect(() => {
        if (projectData && !insightsCache[mode]?.length) {
            generateAnalysis();
        }
    }, [projectData]);

    // Handle mode change - use cache or generate if not cached
    const handleModeChange = (newMode: typeof mode) => {
        setMode(newMode);
        if (!insightsCache[newMode]?.length) {
            generateAnalysis(newMode);
        }
    };

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/30 text-green-300';
            case 'warning': return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
            case 'achievement': return 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 text-yellow-200';
            default: return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
        }
    };

    const modeButtons = [
        { key: 'achievements', label: '🏆 Achievementy' },
        { key: 'charts', label: '📊 Grafy' },
        { key: 'reports', label: '📋 Reporty' },
        { key: 'contacts', label: '👥 Kontakty' }
    ];

    return (
        <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/20 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-[12px] font-black tracking-tighter">TF</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">TenderFlow AI</h3>
                        <p className="text-[10px] text-slate-400">Automatická analýza</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {modeButtons.map(btn => (
                        <button
                            key={btn.key}
                            onClick={() => handleModeChange(btn.key as typeof mode)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${mode === btn.key
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                    <button
                        onClick={() => generateAnalysis(mode, true)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${isLoading ? 'animate-spin' : ''}`}>
                            {isLoading ? 'sync' : 'refresh'}
                        </span>
                        Regenerovat
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : insights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.slice(0, 4).map((insight, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${getTypeStyles(insight.type)}`}>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[24px]">{insight.icon || 'lightbulb'}</span>
                                <div>
                                    <h4 className="text-sm font-bold mb-1">{insight.title}</h4>
                                    <p className="text-xs opacity-80 leading-relaxed">{insight.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <span className="material-symbols-outlined text-[40px] mb-2">psychology</span>
                    <p className="text-xs">Načítám AI analýzu...</p>
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ projects, projectDetails }) => {
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
    const selectedBids = selectedProject?.bids || {};

    // Calculate project metrics
    const getProjectMetrics = () => {
        if (!selectedProject) return null;

        const investorSod = selectedProject.investorFinancials?.sodPrice || 0;
        const investorAmendments = selectedProject.investorFinancials?.amendments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
        const totalBudget = investorSod + investorAmendments;

        const categories = selectedProject.categories || [];
        const sodCategories = categories.filter(c => c.status === 'sod');
        const closedCategories = categories.filter(c => c.status === 'closed');
        const openCategories = categories.filter(c => c.status === 'open');
        const totalContracted = sodCategories.reduce((sum, c) => sum + (c.sodBudget || 0), 0);
        const totalSodAll = categories.reduce((sum, c) => sum + (c.sodBudget || 0), 0);
        const totalPlanned = categories.reduce((sum, c) => sum + (c.planBudget || 0), 0);
        const balance = totalBudget - totalContracted;

        return {
            totalBudget,
            totalContracted,
            totalSodAll,
            totalPlanned,
            balance,
            categories,
            sodCount: sodCategories.length,
            closedCount: closedCategories.length,
            openCount: openCategories.length,
            totalCount: categories.length
        };
    };

    const metrics = getProjectMetrics();

    // Get bid counts per category
    const getCategoryBidInfo = (categoryId: string) => {
        const categoryBids = selectedBids[categoryId] || [];
        const totalBids = categoryBids.length;
        const withPrice = categoryBids.filter(b => b.price && b.price !== '?' && b.price !== '-').length;
        const winners = categoryBids.filter(b => b.status === 'sod');
        const winnersNames = winners.map(w => w.companyName).join(', ');
        const winnersTotal = winners.reduce((sum, w) => {
            const price = parseFloat(String(w.price || '0').replace(/\s/g, '').replace(',', '.'));
            return sum + (isNaN(price) ? 0 : price);
        }, 0);
        return { totalBids, withPrice, winners, winnersNames, winnersTotal };
    };

    // Export to XLSX
    const handleExport = () => {
        if (!selectedProject || !metrics) return;

        const getStatusLabel = (status: string) => {
            switch (status) {
                case 'sod': return 'SOD';
                case 'open': return 'Probíhá';
                case 'cancelled': return 'Zrušeno';
                case 'closed': return 'Ukončeno';
                default: return status;
            }
        };

        const data = metrics.categories.map(cat => {
            const bidInfo = getCategoryBidInfo(cat.id);
            const sodVr = bidInfo.winnersTotal > 0 ? (cat.sodBudget || 0) - bidInfo.winnersTotal : null;
            const pnVr = bidInfo.winnersTotal > 0 ? (cat.planBudget || 0) - bidInfo.winnersTotal : null;
            return {
                'Stav': getStatusLabel(cat.status),
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

        // Add totals row
        const totalCenaVr = metrics.categories.reduce((sum, cat) => {
            const bidInfo = getCategoryBidInfo(cat.id);
            return sum + (bidInfo.winnersTotal || 0);
        }, 0);
        const totalSodVr = metrics.categories.reduce((sum, cat) => {
            const bidInfo = getCategoryBidInfo(cat.id);
            if (bidInfo.winnersTotal > 0) {
                return sum + ((cat.sodBudget || 0) - bidInfo.winnersTotal);
            }
            return sum;
        }, 0);
        const totalPnVr = metrics.categories.reduce((sum, cat) => {
            const bidInfo = getCategoryBidInfo(cat.id);
            if (bidInfo.winnersTotal > 0) {
                return sum + ((cat.planBudget || 0) - bidInfo.winnersTotal);
            }
            return sum;
        }, 0);

        data.push({
            'Stav': '',
            'Poptávka': 'CELKEM',
            'SOD (Kč)': metrics.totalSodAll,
            'Plán (Kč)': metrics.totalPlanned,
            'Cena VŘ (Kč)': totalCenaVr || '-',
            'SOD-VŘ (Kč)': totalCenaVr > 0 ? totalSodVr : '-',
            'PN-VŘ (Kč)': totalCenaVr > 0 ? totalPnVr : '-',
            'Nabídky': '',
            'Vítěz': ''
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Poptávky');

        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }
        ];

        XLSX.writeFile(wb, `prehled-${selectedProject.title.replace(/\s+/g, '-')}.xlsx`);
    };

    if (activeProjects.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
                <Header title="Dashboard" subtitle="Přehled poptávek stavby" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-slate-600 text-[80px] mb-4 block">domain_disabled</span>
                        <h3 className="text-xl font-bold text-slate-400">Žádné aktivní projekty</h3>
                        <p className="text-slate-500 mt-2">Přidejte projekt ve Správě staveb</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <Header title="Dashboard" subtitle="Přehled poptávek stavby">
                <div className="flex items-center gap-3">
                    {/* Project Selector */}
                    <div className="relative">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="appearance-none bg-slate-800 border border-slate-700 text-white px-4 py-2.5 pr-10 rounded-xl text-sm font-medium focus:border-primary min-w-[220px]"
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
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Export XLSX
                    </button>
                </div>
            </Header>

            <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard
                        title="Rozpočet (Investor)"
                        value={formatMoneyShort(metrics?.totalBudget || 0)}
                        icon="account_balance_wallet"
                        color="bg-gradient-to-br from-blue-500 to-indigo-600"
                        subtitle="SOD + Dodatky"
                    />
                    <KPICard
                        title="Zasmluvněno (SOD)"
                        value={formatMoneyShort(metrics?.totalContracted || 0)}
                        icon="handshake"
                        color="bg-gradient-to-br from-emerald-500 to-teal-600"
                        subtitle={`${metrics?.sodCount || 0} kategorií`}
                    />
                    <KPICard
                        title="Bilance"
                        value={(metrics?.balance || 0) >= 0 ? '+' + formatMoneyShort(metrics?.balance || 0) : formatMoneyShort(metrics?.balance || 0)}
                        icon="savings"
                        color={`bg-gradient-to-br ${(metrics?.balance || 0) >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'}`}
                        subtitle={(metrics?.balance || 0) >= 0 ? 'Zisk' : 'Ztráta'}
                    />
                    <KPICard
                        title="Poptávky"
                        value={`${metrics?.sodCount || 0} / ${metrics?.totalCount || 0}`}
                        icon="checklist"
                        color="bg-gradient-to-br from-amber-500 to-orange-600"
                        subtitle={`${metrics?.openCount || 0} v řešení`}
                    />
                </div>

                {/* AI Widget */}
                {metrics && (
                    <AIWidget projectData={{
                        name: selectedProject?.title || '',
                        totalBudget: metrics.totalBudget,
                        totalContracted: metrics.totalContracted,
                        categoriesCount: metrics.totalCount,
                        sodCount: metrics.sodCount,
                        balance: metrics.balance
                    }} />
                )}

                {/* Demands Table */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">table_chart</span>
                            Přehled poptávek
                        </h3>
                        <span className="text-xs text-slate-400">{metrics?.categories.length || 0} položek</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-800/50">
                                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Stav</th>
                                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Poptávka</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">SOD</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Plán</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Cena VŘ</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">SOD-VŘ</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">PN-VŘ</th>
                                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Nabídky</th>
                                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Vítěz</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics?.categories.map((cat, idx) => {
                                    const bidInfo = getCategoryBidInfo(cat.id);
                                    const diffSodVr = (cat.sodBudget || 0) - (bidInfo.winnersTotal || 0);
                                    const diffPnVr = (cat.planBudget || 0) - (bidInfo.winnersTotal || 0);

                                    return (
                                        <tr key={cat.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-center">
                                                <StatusBadge status={cat.status} />
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-white font-medium">{cat.title}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right text-white font-medium">
                                                {cat.sodBudget ? formatMoney(cat.sodBudget) : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-300">
                                                {cat.planBudget ? formatMoney(cat.planBudget) : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {bidInfo.winnersTotal > 0 ? (
                                                    <span className="text-amber-400 font-medium">{formatMoney(bidInfo.winnersTotal)}</span>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {bidInfo.winnersTotal > 0 ? (
                                                    <span className={`font-medium ${diffSodVr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {diffSodVr >= 0 ? '+' : ''}{formatMoney(diffSodVr)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {bidInfo.winnersTotal > 0 ? (
                                                    <span className={`font-medium ${diffPnVr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {diffPnVr >= 0 ? '+' : ''}{formatMoney(diffPnVr)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-slate-300">{bidInfo.withPrice}</span>
                                                    <span className="text-slate-500">/</span>
                                                    <span className="text-slate-500">{bidInfo.totalBids}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 max-w-[200px]">
                                                {bidInfo.winnersNames ? (
                                                    <span className="text-emerald-400 font-medium break-words whitespace-normal">{bidInfo.winnersNames}</span>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {metrics && metrics.categories.length > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-800/30 font-bold">
                                        <td className="py-3 px-4 text-center text-slate-400"></td>
                                        <td className="py-3 px-4 text-white">Celkem</td>
                                        <td className="py-3 px-4 text-right text-white">{formatMoney(metrics.totalSodAll)}</td>
                                        <td className="py-3 px-4 text-right text-slate-300">{formatMoney(metrics.totalPlanned)}</td>
                                        <td className="py-3 px-4 text-right">
                                            {(() => {
                                                const totalWinnersPrice = metrics.categories.reduce((sum, cat) => {
                                                    const bidInfo = getCategoryBidInfo(cat.id);
                                                    return sum + (bidInfo.winnersTotal || 0);
                                                }, 0);
                                                return totalWinnersPrice > 0 ? (
                                                    <span className="text-amber-400">{formatMoney(totalWinnersPrice)}</span>
                                                ) : <span className="text-slate-500">-</span>;
                                            })()}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {(() => {
                                                // Sum only rows that have winner prices
                                                const totalSodVr = metrics.categories.reduce((sum, cat) => {
                                                    const bidInfo = getCategoryBidInfo(cat.id);
                                                    if (bidInfo.winnersTotal > 0) {
                                                        return sum + ((cat.sodBudget || 0) - bidInfo.winnersTotal);
                                                    }
                                                    return sum;
                                                }, 0);
                                                const hasAnyWinners = metrics.categories.some(cat => getCategoryBidInfo(cat.id).winnersTotal > 0);
                                                return hasAnyWinners ? (
                                                    <span className={`${totalSodVr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {totalSodVr >= 0 ? '+' : ''}{formatMoney(totalSodVr)}
                                                    </span>
                                                ) : <span className="text-slate-500">-</span>;
                                            })()}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {(() => {
                                                // Sum only rows that have winner prices
                                                const totalPnVr = metrics.categories.reduce((sum, cat) => {
                                                    const bidInfo = getCategoryBidInfo(cat.id);
                                                    if (bidInfo.winnersTotal > 0) {
                                                        return sum + ((cat.planBudget || 0) - bidInfo.winnersTotal);
                                                    }
                                                    return sum;
                                                }, 0);
                                                const hasAnyWinners = metrics.categories.some(cat => getCategoryBidInfo(cat.id).winnersTotal > 0);
                                                return hasAnyWinners ? (
                                                    <span className={`${totalPnVr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {totalPnVr >= 0 ? '+' : ''}{formatMoney(totalPnVr)}
                                                    </span>
                                                ) : <span className="text-slate-500">-</span>;
                                            })()}
                                        </td>
                                        <td colSpan={2} className="py-3 px-4"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {(!metrics?.categories || metrics.categories.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <span className="material-symbols-outlined text-[48px] mb-3">folder_open</span>
                            <p className="text-sm">Žádné poptávky</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
