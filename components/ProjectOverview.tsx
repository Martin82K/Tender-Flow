import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Project, ProjectDetails, DemandCategory } from '../types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMoney, formatMoneyShort } from '../utils/formatters';
import { generateProjectInsights, AIInsight } from '../services/aiInsightsService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProjectOverviewProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
}

// KPI Card Component
const KPICard: React.FC<{
    title: string;
    value: string;
    icon: string;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon, color, subtitle, trend }) => (
    <div className="bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg hover:border-white/20 transition-all">
        <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-[10px] font-medium mb-1 uppercase tracking-wider">{title}</p>
                <h3 className="text-lg font-bold text-white truncate">{value}</h3>
                {subtitle && (
                    <div className="flex items-center gap-1 mt-0.5">
                        {trend && (
                            <span className={`material-symbols-outlined text-[12px] ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                                {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat'}
                            </span>
                        )}
                        <p className="text-[10px] text-slate-500">{subtitle}</p>
                    </div>
                )}
            </div>
            <div className={`p-2 rounded-lg ${color} text-white shadow-lg shrink-0`}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </div>
        </div>
    </div>
);

// Progress Ring Component
const ProgressRing: React.FC<{ progress: number; size?: number; strokeWidth?: number; color?: string; id?: string }> = ({
    progress,
    size = 60,
    strokeWidth = 6,
    color = '#8B5CF6',
    id = 'default'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
            />
        </svg>
    );
};

// Chart colors
const CHART_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ projects, projectDetails }) => {
    const activeProjects = projects.filter(p => p.status !== 'archived');
    const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjects[0]?.id || '');
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasGeneratedAI, setHasGeneratedAI] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const selectedProject = projectDetails[selectedProjectId];

    // Calculate project metrics
    const getProjectMetrics = () => {
        if (!selectedProject) return null;

        const investorSod = selectedProject.investorFinancials?.sodPrice || 0;
        const investorAmendments = selectedProject.investorFinancials?.amendments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
        const totalBudget = investorSod + investorAmendments;

        const categories = selectedProject.categories || [];
        const sodCategories = categories.filter(c => c.status === 'sod');
        const openCategories = categories.filter(c => c.status === 'open');
        const totalContracted = sodCategories.reduce((sum, c) => sum + (c.sodBudget || 0), 0);
        const totalPlanned = categories.reduce((sum, c) => sum + (c.planBudget || 0), 0);
        const balance = totalBudget - totalContracted;
        const balanceVsPlan = totalPlanned - totalContracted;
        const sodProgress = categories.length > 0 ? (sodCategories.length / categories.length) * 100 : 0;

        // Calculate per-category profitability
        const categoryProfitability = categories.map(cat => {
            const planBudget = cat.planBudget || 0;
            const sodBudget = cat.sodBudget || 0;
            const diffVsPlan = planBudget - sodBudget;
            const isProfitable = diffVsPlan >= 0;
            return {
                ...cat,
                diffVsPlan,
                isProfitable,
                profitPercent: planBudget > 0 ? (diffVsPlan / planBudget) * 100 : 0
            };
        }).filter(c => c.status === 'sod');

        const profitableCategories = categoryProfitability.filter(c => c.isProfitable);
        const unprofitableCategories = categoryProfitability.filter(c => !c.isProfitable);

        return {
            totalBudget,
            totalContracted,
            totalPlanned,
            balance,
            balanceVsPlan,
            sodProgress,
            categoriesCount: categories.length,
            sodCount: sodCategories.length,
            openCount: openCategories.length,
            categories,
            categoryProfitability,
            profitableCategories,
            unprofitableCategories,
            profitableSum: profitableCategories.reduce((s, c) => s + c.diffVsPlan, 0),
            unprofitableSum: unprofitableCategories.reduce((s, c) => s + Math.abs(c.diffVsPlan), 0)
        };
    };

    const metrics = getProjectMetrics();

    // Reset AI when project changes
    useEffect(() => {
        setAiAnalysis('');
        setHasGeneratedAI(false);
    }, [selectedProjectId]);

    // Manual AI generation
    const generateAIAnalysis = async () => {
        if (!selectedProject || !metrics) return;

        setIsAnalyzing(true);
        try {
            const projectSummary = [{
                name: selectedProject.title,
                totalBudget: metrics.totalBudget,
                totalContracted: metrics.totalContracted,
                categoriesCount: metrics.categoriesCount,
                sodCount: metrics.sodCount,
                balance: metrics.balance
            }];

            const insights = await generateProjectInsights(projectSummary, 'reports');
            const analysisText = insights.map(i => `**${i.title}**\n${i.content}`).join('\n\n');
            setAiAnalysis(analysisText || 'Analýza není k dispozici.');
            setHasGeneratedAI(true);
        } catch (error) {
            console.error('AI analysis error:', error);
            setAiAnalysis('Nepodařilo se vygenerovat analýzu.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // PDF Export
    const handleExportPDF = async () => {
        if (!contentRef.current || !selectedProject) return;

        try {
            const canvas = await html2canvas(contentRef.current, {
                backgroundColor: '#0f172a',
                scale: 2,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgScaledWidth = imgWidth * ratio;
            const imgScaledHeight = imgHeight * ratio;
            const x = (pdfWidth - imgScaledWidth) / 2;

            pdf.addImage(imgData, 'PNG', x, 10, imgScaledWidth, imgScaledHeight);
            pdf.save(`prehled-${selectedProject.title.replace(/\s+/g, '-')}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Chyba při exportu PDF.');
        }
    };

    // Chart data
    const categoryChartData = metrics?.categories.filter(c => c.status === 'sod').map(cat => ({
        name: cat.title.length > 12 ? cat.title.substring(0, 12) + '...' : cat.title,
        plán: cat.planBudget || 0,
        SOD: cat.sodBudget || 0,
        rozdíl: (cat.planBudget || 0) - (cat.sodBudget || 0)
    })) || [];

    const pieChartData = metrics?.categories.filter(c => c.status === 'sod').map((cat, idx) => ({
        name: cat.title,
        value: cat.sodBudget || 0,
        color: CHART_COLORS[idx % CHART_COLORS.length]
    })).filter(d => d.value > 0) || [];

    const profitabilityChartData = [
        { name: 'Ziskové', value: metrics?.profitableSum || 0, color: '#10B981' },
        { name: 'Ztrátové', value: metrics?.unprofitableSum || 0, color: '#EF4444' }
    ].filter(d => d.value > 0);

    const statusChartData = [
        { name: 'SOD uzavřeno', value: metrics?.sodCount || 0, color: '#10B981' },
        { name: 'V řešení', value: metrics?.openCount || 0, color: '#F59E0B' },
        { name: 'Ostatní', value: (metrics?.categoriesCount || 0) - (metrics?.sodCount || 0) - (metrics?.openCount || 0), color: '#64748b' }
    ].filter(d => d.value > 0);

    if (activeProjects.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
                <Header title="Přehled staveb" subtitle="Detailní analýza vybraného projektu" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-slate-600 text-[80px] mb-4 block">domain_disabled</span>
                        <h3 className="text-xl font-bold text-slate-400">Žádné aktivní projekty</h3>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <Header title="Přehled staveb" subtitle="Detailní analýza vybraného projektu">
                {/* Project Selector */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="appearance-none bg-slate-800 border border-slate-700 text-white px-4 py-2.5 pr-10 rounded-xl text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[200px]"
                        >
                            {activeProjects.map(project => (
                                <option key={project.id} value={project.id}>
                                    {projectDetails[project.id]?.title || project.name}
                                </option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                    </div>

                    {/* PDF Export Button */}
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Export PDF
                    </button>
                </div>
            </Header>

            <div ref={contentRef} className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1800px] mx-auto w-full">

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <KPICard title="Rozpočet (Investor)" value={formatMoneyShort(metrics?.totalBudget || 0)} icon="account_balance" color="bg-gradient-to-br from-blue-500 to-blue-600" />
                    <KPICard title="Plán (interní)" value={formatMoneyShort(metrics?.totalPlanned || 0)} icon="analytics" color="bg-gradient-to-br from-violet-500 to-purple-600" />
                    <KPICard title="Zasmluvněno (SOD)" value={formatMoneyShort(metrics?.totalContracted || 0)} icon="handshake" color="bg-gradient-to-br from-emerald-500 to-teal-600" />
                    <KPICard
                        title="Bilance vs Investor"
                        value={(metrics?.balance || 0) >= 0 ? '+' + formatMoneyShort(metrics?.balance || 0) : formatMoneyShort(metrics?.balance || 0)}
                        icon="savings"
                        color={`bg-gradient-to-br ${(metrics?.balance || 0) >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'}`}
                        trend={(metrics?.balance || 0) >= 0 ? 'up' : 'down'}
                    />
                    <KPICard
                        title="Bilance vs Plán"
                        value={(metrics?.balanceVsPlan || 0) >= 0 ? '+' + formatMoneyShort(metrics?.balanceVsPlan || 0) : formatMoneyShort(metrics?.balanceVsPlan || 0)}
                        icon="compare"
                        color={`bg-gradient-to-br ${(metrics?.balanceVsPlan || 0) >= 0 ? 'from-cyan-500 to-blue-600' : 'from-orange-500 to-red-600'}`}
                        trend={(metrics?.balanceVsPlan || 0) >= 0 ? 'up' : 'down'}
                    />
                    <KPICard title="SOD Progress" value={`${Math.round(metrics?.sodProgress || 0)}%`} icon="check_circle" color="bg-gradient-to-br from-amber-500 to-orange-600" subtitle={`${metrics?.sodCount || 0} z ${metrics?.categoriesCount || 0}`} />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* AI Analysis Card */}
                    <div className="lg:col-span-1 bg-gradient-to-br from-violet-900/30 to-blue-900/30 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg">
                                    <span className="material-symbols-outlined text-white text-[18px]">auto_awesome</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">AI Analýza</h3>
                                    <p className="text-[10px] text-slate-400">TenderFlow AI</p>
                                </div>
                            </div>
                            <button
                                onClick={generateAIAnalysis}
                                disabled={isAnalyzing}
                                className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                                <span className={`material-symbols-outlined text-[16px] ${isAnalyzing ? 'animate-spin' : ''}`}>
                                    {isAnalyzing ? 'sync' : 'refresh'}
                                </span>
                                {hasGeneratedAI ? 'Regenerovat' : 'Generovat'}
                            </button>
                        </div>

                        {isAnalyzing ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : aiAnalysis ? (
                            <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-line max-h-[300px] overflow-y-auto">
                                {aiAnalysis}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                                <span className="material-symbols-outlined text-[40px] mb-2">psychology</span>
                                <p className="text-xs">Klikněte na "Generovat" pro AI analýzu</p>
                            </div>
                        )}
                    </div>

                    {/* Bar Chart - Plan vs SOD */}
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-400 text-[18px]">bar_chart</span>
                            Plán vs. Zasmluvněno (SOD kategorie)
                        </h3>
                        {categoryChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={categoryChartData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => formatMoneyShort(v)} width={60} />
                                    <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                    <Bar dataKey="plán" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="SOD" fill="#10B981" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[250px] text-slate-500 text-sm">Žádné SOD kategorie</div>
                        )}
                    </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                    {/* Profitability Pie */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">pie_chart</span>
                            Ziskovost vs Plán
                        </h3>
                        {profitabilityChartData.length > 0 ? (
                            <div className="flex flex-col items-center">
                                <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                        <Pie data={profitabilityChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                                            {profitabilityChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex gap-4 mt-2">
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-slate-400">Ziskové: {formatMoneyShort(metrics?.profitableSum || 0)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <span className="text-slate-400">Ztrátové: {formatMoneyShort(metrics?.unprofitableSum || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[180px] text-slate-500 text-xs">Žádná data</div>
                        )}
                    </div>

                    {/* Status Pie */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-400 text-[18px]">donut_large</span>
                            Stav kategorií
                        </h3>
                        {statusChartData.length > 0 ? (
                            <div className="flex flex-col items-center">
                                <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                        <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                                            {statusChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap justify-center gap-3 mt-2">
                                    {statusChartData.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-1 text-[10px]">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-slate-400">{item.name}: {item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[180px] text-slate-500 text-xs">Žádná data</div>
                        )}
                    </div>

                    {/* Categories Distribution Pie */}
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-violet-400 text-[18px]">data_usage</span>
                            Rozložení SOD nákladů
                        </h3>
                        {pieChartData.length > 0 ? (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="45%" height={160}>
                                    <PieChart>
                                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-1 max-h-[160px] overflow-y-auto">
                                    {pieChartData.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-slate-300 truncate flex-1">{item.name}</span>
                                            <span className="text-slate-500">{formatMoneyShort(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[160px] text-slate-500 text-xs">Žádné SOD kategorie</div>
                        )}
                    </div>
                </div>

                {/* Category Profitability Table */}
                {metrics?.categoryProfitability && metrics.categoryProfitability.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-cyan-400 text-[18px]">table_chart</span>
                            Bilance kategorií vs. Plán
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Kategorie</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Plán</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">SOD</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Rozdíl</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.categoryProfitability.map((cat, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-2 px-3 text-slate-200">{cat.title}</td>
                                            <td className="text-right py-2 px-3 text-slate-400">{formatMoney(cat.planBudget || 0)}</td>
                                            <td className="text-right py-2 px-3 text-slate-300">{formatMoney(cat.sodBudget || 0)}</td>
                                            <td className={`text-right py-2 px-3 font-medium ${cat.isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {cat.isProfitable ? '+' : ''}{formatMoney(cat.diffVsPlan)}
                                            </td>
                                            <td className={`text-right py-2 px-3 ${cat.isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {cat.profitPercent.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-white/20 font-bold">
                                        <td className="py-2 px-3 text-white">Celkem</td>
                                        <td className="text-right py-2 px-3 text-slate-300">{formatMoney(metrics.totalPlanned)}</td>
                                        <td className="text-right py-2 px-3 text-slate-200">{formatMoney(metrics.totalContracted)}</td>
                                        <td className={`text-right py-2 px-3 ${metrics.balanceVsPlan >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {metrics.balanceVsPlan >= 0 ? '+' : ''}{formatMoney(metrics.balanceVsPlan)}
                                        </td>
                                        <td className="text-right py-2 px-3 text-slate-400">-</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
