
import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Project, ProjectDetails } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney, formatMoneyShort, formatChartAxis } from '../utils/formatters';
import { generateProjectInsights, generateLocalInsights } from '../services/aiInsightsService';

interface DashboardProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
}

// --- Helper Functions ---

// Using central formatter - formatMoney for full amounts
const formatMoneyFull = formatMoney;


// --- Logic to aggregate data ---

interface ProjectFinancials {
    id: string;
    name: string;
    totalBudget: number; // Revenue (Investor SOD + Amendments)
    totalContracted: number; // Costs from SOD categories
    categories: {
        name: string;
        sodBudget: number;
        planBudget: number;
        status: string;
    }[];
}

const getProjectData = (project: Project, details: ProjectDetails): ProjectFinancials => {
    // Calculate Total Revenue (Budget) from Investor Contract
    const investorSod = details.investorFinancials?.sodPrice || 0;
    const investorAmendmentsTotal = details.investorFinancials?.amendments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
    const totalBudget = investorSod + investorAmendmentsTotal;

    // Calculate total contracted (only SOD categories)
    const totalContracted = details.categories
        .filter(cat => cat.status === 'sod')
        .reduce((sum, cat) => sum + (cat.sodBudget || 0), 0);

    const categories = details.categories.map(cat => ({
        name: cat.title,
        sodBudget: cat.sodBudget || 0,
        planBudget: cat.planBudget || 0,
        status: cat.status
    }));

    return {
        id: project.id,
        name: details.title || project.name,
        totalBudget,
        totalContracted,
        categories
    };
};

// --- Components ---

const KPICard: React.FC<{ title: string; value: string; icon: string; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} text-white`}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
    </div>
);

const ProjectCard: React.FC<{ project: Project; details: ProjectDetails }> = ({ project, details }) => {
    const data = getProjectData(project, details);
    const percentSpent = data.totalBudget > 0 ? (data.totalContracted / data.totalBudget) * 100 : 0;
    const diff = data.totalBudget - data.totalContracted;
    
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">apartment</span>
                        {data.name}
                    </h3>
                </div>
                <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {diff >= 0 ? 'Zisk' : 'Ztráta'}
                    </span>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4 bg-white dark:bg-slate-900">
                <div>
                     <p className="text-xs text-slate-500 uppercase tracking-wider">Rozpočet (Investor)</p>
                     <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{formatMoneyFull(data.totalBudget)}</p>
                </div>
                <div className="text-right">
                     <p className="text-xs text-slate-500 uppercase tracking-wider">Zasmluvněno (Náklady)</p>
                     <p className="text-lg font-bold text-primary">{formatMoneyFull(data.totalContracted)}</p>
                </div>
                 <div className="col-span-2 mt-2">
                     <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                         <div 
                            className={`h-full rounded-full transition-all duration-500 ${percentSpent > 100 ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(percentSpent, 100)}%` }}
                         ></div>
                     </div>
                     <div className="flex justify-between mt-1">
                        <p className="text-xs text-slate-400">{Math.round(percentSpent)}% vyčerpáno</p>
                        <p className={`text-xs font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                             {diff >= 0 ? '+' : ''}{formatMoneyFull(diff)}
                        </p>
                     </div>
                 </div>
            </div>

            {/* Categories List */}
            <div className="border-t border-slate-100 dark:border-slate-800">
                 <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 uppercase flex justify-between">
                     <span>Kategorie</span>
                     <span>Stav</span>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                    {data.categories.length > 0 ? data.categories.map((cat, idx) => {
                        const hasSOD = cat.status === 'sod';
                        const catDiff = cat.planBudget - cat.sodBudget;
                        
                        return (
                            <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{cat.name}</p>
                                </div>
                                <div className="text-right">
                                    {hasSOD ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatMoneyFull(cat.sodBudget)}</span>
                                            <span className={`text-[10px] ${catDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                vs Plán: {catDiff >= 0 ? '-' : '+'}{formatMoney(Math.abs(catDiff))}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">{cat.status === 'open' ? 'V řešení' : cat.status}</span>
                                    )}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="px-6 py-8 text-center">
                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-4xl mb-2 block">category</span>
                            <p className="text-sm text-slate-500">Žádné kategorie</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};

// AI Insights Widget Component
interface ProjectSummary {
    name: string;
    totalBudget: number;
    totalContracted: number;
    categoriesCount: number;
    sodCount: number;
    balance: number;
}

interface AIInsight {
    title: string;
    content: string;
    type: 'success' | 'warning' | 'info' | 'tip' | 'achievement' | 'chart';
    icon: string;
    progress?: number;
    stats?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
    achievement?: { level: number; maxLevel: number; label: string };
    chartData?: { label: string; value: number; color?: string }[];
    chartType?: 'bar' | 'pie' | 'progress';
}

const AIInsightsWidget: React.FC<{ projects: ProjectSummary[] }> = ({ projects }) => {
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [aiEnabled, setAiEnabled] = useState(true);
    const [showDisabledWarning, setShowDisabledWarning] = useState(false);
    const [mode, setMode] = useState<'achievements' | 'charts' | 'reports'>('achievements');

    // Check localStorage for AI enabled setting
    useEffect(() => {
        const stored = localStorage.getItem('aiEnabled');
        setAiEnabled(stored !== 'false');
    }, []);

    // Load insights with caching
    useEffect(() => {
        const loadInsights = async () => {
            setIsLoading(true);
            const cacheKey = `ai_insights_${mode}`;
            
            // Try to load from session storage first
            const cachedData = sessionStorage.getItem(cacheKey);
            
            try {
                // Check if AI is enabled by admin
                if (!aiEnabled) {
                    setShowDisabledWarning(true);
                    const localInsights = generateLocalInsights(projects);
                    setInsights(localInsights);
                } else if (process.env.GEMINI_API_KEY) {
                    setShowDisabledWarning(false);
                    
                    if (cachedData) {
                        // Use cached data if available
                        console.log(`[AI] Using cached insights for mode: ${mode}`);
                        setInsights(JSON.parse(cachedData));
                    } else {
                        // Generate new insights if not cached
                        console.log(`[AI] Generating new insights for mode: ${mode}`);
                        const aiInsights = await generateProjectInsights(projects, mode);
                        sessionStorage.setItem(cacheKey, JSON.stringify(aiInsights));
                        setInsights(aiInsights);
                    }
                } else {
                    // Fallback to local
                    const localInsights = generateLocalInsights(projects);
                    setInsights(localInsights);
                }
            } catch (error) {
                console.error('[AI] Error:', error);
                const localInsights = generateLocalInsights(projects);
                setInsights(localInsights);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadInsights();
    }, [projects, aiEnabled, mode]);

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
            case 'warning':
                return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200';
            case 'tip':
                return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200';
            case 'achievement':
                return 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100';
            default:
                return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
        }
    };

    const getIconBg = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-500';
            case 'warning': return 'bg-amber-500';
            case 'tip': return 'bg-purple-500';
            case 'achievement': return 'bg-gradient-to-br from-yellow-400 to-orange-500';
            default: return 'bg-blue-500';
        }
    };

    const getAchievementColor = (label: string) => {
        switch (label?.toLowerCase()) {
            case 'bronze': return 'from-amber-600 to-amber-800';
            case 'silver': return 'from-slate-400 to-slate-600';
            case 'gold': return 'from-yellow-400 to-yellow-600';
            case 'platinum': return 'from-cyan-300 to-cyan-500';
            case 'diamond': return 'from-purple-400 to-blue-500';
            default: return 'from-slate-400 to-slate-600';
        }
    };

    const refreshInsights = async () => {
        setIsLoading(true);
        const cacheKey = `ai_insights_${mode}`;
        
        try {
            if (aiEnabled && process.env.GEMINI_API_KEY) {
                // Remove from cache to force regeneration
                sessionStorage.removeItem(cacheKey);
                const aiInsights = await generateProjectInsights(projects, mode);
                sessionStorage.setItem(cacheKey, JSON.stringify(aiInsights));
                setInsights(aiInsights);
            } else {
                const localInsights = generateLocalInsights(projects);
                setInsights(localInsights);
            }
        } catch (error) {
            console.error('Error refreshing insights:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                        <span className="material-symbols-outlined text-white">auto_awesome</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI</h3>
                        <p className="text-xs text-slate-500">Automatická analýza projektů</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => setMode('achievements')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                mode === 'achievements' 
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            🏆 Achievementy
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('charts')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                mode === 'charts' 
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            📊 Grafy
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('reports')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                mode === 'reports' 
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            📋 Reporty
                        </button>
                    </div>
                    
                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            refreshInsights();
                        }}
                        disabled={isLoading}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title="Obnovit analýzu"
                    >
                        <span className={`material-symbols-outlined text-slate-500 ${isLoading ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-500">Analyzuji data...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-xl border-2 ${getTypeStyles(insight.type)} transition-all hover:scale-[1.02] hover:shadow-lg ${insight.type === 'achievement' ? 'shadow-md' : ''}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2.5 rounded-xl ${getIconBg(insight.type)} text-white shrink-0 shadow-sm`}>
                                    <span className="material-symbols-outlined text-[22px]">{insight.icon || 'emoji_events'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                                    <p className="text-xs opacity-80 mb-2">{insight.content}</p>
                                    
                                    {/* Progress Bar */}
                                    {insight.progress !== undefined && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] mb-1 opacity-70">
                                                <span>Pokrok</span>
                                                <span>{Math.round(insight.progress)}%</span>
                                            </div>
                                            <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${getIconBg(insight.type)}`}
                                                    style={{ width: `${Math.min(100, Math.max(0, insight.progress))}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Achievement Level */}
                                    {insight.achievement && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className={`flex gap-1`}>
                                                {Array.from({ length: insight.achievement.maxLevel || 5 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-4 h-4 rounded-full ${
                                                            i < (insight.achievement?.level || 0)
                                                                ? `bg-gradient-to-br ${getAchievementColor(insight.achievement?.label || '')}`
                                                                : 'bg-black/10 dark:bg-white/10'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                                {insight.achievement.label}
                                            </span>
                                        </div>
                                    )}

                                    {/* Stats */}
                                    {insight.stats && insight.stats.length > 0 && (
                                        <div className="mt-3 flex gap-4">
                                            {insight.stats.slice(0, 2).map((stat, i) => (
                                                <div key={i} className="flex items-center gap-1.5">
                                                    {stat.trend && (
                                                        <span className={`material-symbols-outlined text-[14px] ${
                                                            stat.trend === 'up' ? 'text-green-600' : 
                                                            stat.trend === 'down' ? 'text-red-500' : 'text-slate-400'
                                                        }`}>
                                                    </span>
                                                    )}
                                                    <div>
                                                        <p className="text-[10px] opacity-60">{stat.label}</p>
                                                        <p className="text-xs font-bold">{stat.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Chart Visualization */}
                                    {insight.chartData && insight.chartData.length > 0 && (
                                        <div className="mt-4">
                                            {/* Bar Chart */}
                                            {insight.chartType === 'bar' && (
                                                <div className="space-y-2">
                                                    {insight.chartData.map((item, i) => {
                                                        const maxVal = Math.max(...(insight.chartData?.map(d => d.value) || [1]));
                                                        const width = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                                                        return (
                                                            <div key={i} className="flex items-center gap-2">
                                                                <span className="text-[10px] w-20 truncate opacity-70">{item.label}</span>
                                                                <div className="flex-1 h-4 bg-black/5 dark:bg-white/5 rounded overflow-hidden">
                                                                    <div 
                                                                        className="h-full rounded transition-all duration-500"
                                                                        style={{ 
                                                                            width: `${width}%`,
                                                                            backgroundColor: item.color || '#3B82F6'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] font-bold w-12 text-right">
                                                                    {item.value > 1000000 ? `${(item.value/1000000).toFixed(1)}M` : item.value.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Pie Chart */}
                                            {insight.chartType === 'pie' && (
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-16 h-16">
                                                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                                            {insight.chartData.reduce((acc, item, i) => {
                                                                const total = insight.chartData?.reduce((s, d) => s + d.value, 0) || 1;
                                                                const percent = (item.value / total) * 100;
                                                                const offset = acc.offset;
                                                                acc.offset += percent;
                                                                acc.elements.push(
                                                                    <circle
                                                                        key={i}
                                                                        cx="18" cy="18" r="15.9"
                                                                        fill="none"
                                                                        stroke={item.color || '#3B82F6'}
                                                                        strokeWidth="3"
                                                                        strokeDasharray={`${percent} ${100 - percent}`}
                                                                        strokeDashoffset={-offset}
                                                                    />
                                                                );
                                                                return acc;
                                                            }, { offset: 0, elements: [] as React.ReactElement[] }).elements}
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        {insight.chartData.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                                <div 
                                                                    className="w-2 h-2 rounded-full shrink-0" 
                                                                    style={{ backgroundColor: item.color || '#3B82F6' }}
                                                                />
                                                                <span className="truncate flex-1">{item.label}</span>
                                                                <span className="font-bold">{item.value}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress Chart */}
                                            {insight.chartType === 'progress' && insight.chartData[0] && (
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1 opacity-70">
                                                        <span>{insight.chartData[0].label}</span>
                                                        <span>{insight.chartData[0].value}%</span>
                                                    </div>
                                                    <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full rounded-full transition-all duration-700"
                                                            style={{ 
                                                                width: `${Math.min(100, insight.chartData[0].value)}%`,
                                                                backgroundColor: insight.chartData[0].color || '#10B981'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showDisabledWarning && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">info</span>
                        AI analýza je vypnuta administrátorem. Zobrazuji lokální statistiky.
                    </p>
                </div>
            )}

            {!process.env.GEMINI_API_KEY && !showDisabledWarning && (
                <p className="text-xs text-slate-400 mt-4 text-center italic">
                    💡 Pro pokročilou AI analýzu přidejte GEMINI_API_KEY do .env
                </p>
            )}
        </div>
    );
};

const EmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="text-center max-w-md">
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[100px] mb-4 block">domain_disabled</span>
            <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">Žádné projekty</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
                Zatím nemáte žádné aktivní projekty. Začněte přidáním nového projektu v nastavení.
            </p>
            <span className="material-symbols-outlined text-primary text-5xl">arrow_downward</span>
            <p className="text-sm text-slate-400 mt-2">Použijte menu vlevo → Nastavení</p>
        </div>
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ projects, projectDetails }) => {
  const activeProjects = projects.filter(p => p.status !== 'archived');

  if (activeProjects.length === 0) {
    return (
        <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <Header title="Dashboard" subtitle="Celkový přehled staveb a financí" />
            <EmptyState />
        </div>
    );
  }
  
  // Global Stats Calculation
  const allProjectsData = activeProjects
    .filter(p => projectDetails[p.id])
    .map(p => getProjectData(p, projectDetails[p.id]));
  
  const totalBudget = allProjectsData.reduce((acc, curr) => acc + curr.totalBudget, 0);
  const totalContracted = allProjectsData.reduce((acc, curr) => acc + curr.totalContracted, 0);
  const totalProjects = allProjectsData.length;
  const totalBalance = totalBudget - totalContracted;
  
  // Chart Data
  const chartData = allProjectsData.map(p => ({
      name: p.name.split(' ')[0], // Short name
      budget: p.totalBudget,
      contracted: p.totalContracted
  }));

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
      <Header title="Dashboard" subtitle="Celkový přehled staveb a financí" />
      
      <div className="p-6 lg:p-10 flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
        
        {/* 1. Global KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
                title="Aktivní Stavby" 
                value={totalProjects.toString()} 
                icon="domain" 
                color="bg-blue-500" 
            />
            <KPICard 
                title="Celkový Rozpočet (Investor)" 
                value={formatMoneyFull(totalBudget)} 
                icon="account_balance_wallet" 
                color="bg-slate-500" 
                subtitle="Součet SOD + Dodatky"
            />
            <KPICard 
                title="Zasmluvněno (Náklady)" 
                value={formatMoneyFull(totalContracted)} 
                icon="handshake" 
                color="bg-primary" 
                subtitle="Ceny subdodavatelů"
            />
             <KPICard 
                title="Bilance Zisku" 
                value={(totalBalance >= 0 ? '+' : '') + formatMoneyFull(totalBalance)} 
                icon="savings" 
                color={totalBalance >= 0 ? "bg-green-500" : "bg-red-500"}
                subtitle={totalBalance >= 0 ? "Zisk" : "Ztráta"}
            />
        </div>

        {/* 2. AI Insights Section */}
        {allProjectsData.length > 0 && (
            <AIInsightsWidget projects={allProjectsData.map(p => ({
                name: p.name,
                totalBudget: p.totalBudget,
                totalContracted: p.totalContracted,
                categoriesCount: p.categories.length,
                sodCount: p.categories.filter(c => c.status === 'sod').length,
                balance: p.totalBudget - p.totalContracted
            }))} />
        )}

        {/* 3. Project Detail Grid */}
        <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">view_module</span>
                Detailní přehled staveb
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {activeProjects.map(project => projectDetails[project.id] && (
                    <ProjectCard key={project.id} project={project} details={projectDetails[project.id]} />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
