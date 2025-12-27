import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Project, ProjectDetails, DemandCategory } from '../types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatMoney, formatMoneyShort } from '../utils/formatters';
import { generateProjectInsights, AIInsight } from '../services/aiInsightsService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RobotoRegularBase64 } from '../fonts/roboto-regular';

interface ProjectOverviewProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
}

// KPI Card Component - compact version
const KPICard: React.FC<{
    title: string;
    value: string;
    icon: string;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon, color, subtitle, trend }) => (
    <div className="bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg hover:border-white/20 transition-all">
        <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider truncate">{title}</p>
                <h3 className="text-lg font-bold text-white truncate mt-1">{value}</h3>
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
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
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

    // Load last selected project from localStorage or use first active
    const getInitialProjectId = () => {
        const saved = localStorage.getItem('overviewSelectedProject');
        if (saved && activeProjects.some(p => p.id === saved)) {
            return saved;
        }
        return activeProjects[0]?.id || '';
    };

    const [selectedProjectId, setSelectedProjectId] = useState<string>(getInitialProjectId);
    const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasGeneratedAI, setHasGeneratedAI] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Save to localStorage when project changes
    React.useEffect(() => {
        if (selectedProjectId) {
            localStorage.setItem('overviewSelectedProject', selectedProjectId);
        }
    }, [selectedProjectId]);

    const selectedProject = projectDetails[selectedProjectId];

    // Calculate project metrics
    const getProjectMetrics = () => {
        if (!selectedProject) return null;

        const investorSod = selectedProject.investorFinancials?.sodPrice || 0;
        const investorAmendments = selectedProject.investorFinancials?.amendments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
        const totalBudget = investorSod + investorAmendments;

        const categories = selectedProject.categories || [];
        const bids = selectedProject.bids || {};

        console.log('[ProjectOverview] selectedProject.bids:', selectedProject.bids);
        console.log('[ProjectOverview] categories:', categories.map(c => ({ id: c.id, title: c.title })));

        const openCategories = categories.filter(c => c.status === 'open');
        const totalPlanned = categories.reduce((sum, c) => sum + (c.planBudget || 0), 0);

        // Better calculation for Contracted Cost: Sum of all winning bids
        let totalContracted = 0;
        let contractedBidsTotal = 0;
        let contractedBidsCount = 0;
        let profitableFromBids = 0;
        let unprofitableFromBids = 0;
        let sodCategoriesCount = 0;

        const categoryProfitability = categories.map(cat => {
            const categoryBids = bids[cat.id] || [];
            // Winning bids: status 'sod'. In new logic we might also check 'contracted' flag if strictly used,
            // but 'sod' status on bid usually implies it is the winning one.
            const winningBids = categoryBids.filter(b => b.status === 'sod');

            let catContractedAmount = 0;
            if (winningBids.length > 0) {
                sodCategoriesCount++;
                winningBids.forEach(bid => {
                    const priceStr = bid.price?.toString().replace(/[^\d]/g, '') || '0';
                    const bidPrice = parseInt(priceStr) || 0;
                    if (bidPrice > 0) {
                        catContractedAmount += bidPrice;
                        contractedBidsTotal += bidPrice;
                        contractedBidsCount++;
                    }
                });
            }

            // Profitability for this category
            const planBudget = cat.planBudget || 0;

            // If we have contracted amount, use it. Otherwise use sodBudget from category if available (legacy), else 0.
            const actualCost = catContractedAmount > 0 ? catContractedAmount : (cat.sodBudget || 0);

            // Only calculate diff if we have an actual cost (SOD)
            const diffVsPlan = actualCost > 0 ? planBudget - actualCost : 0;
            const isProfitable = diffVsPlan >= 0;

            if (actualCost > 0) {
                if (diffVsPlan >= 0) profitableFromBids += diffVsPlan;
                else unprofitableFromBids += Math.abs(diffVsPlan);
            }

            return {
                ...cat,
                sodBudget: actualCost, // Override with calculated cost for display
                diffVsPlan,
                isProfitable,
                profitPercent: planBudget > 0 ? (diffVsPlan / planBudget) * 100 : 0,
                hasWinningBid: winningBids.length > 0
            };
        });

        // Use the calculated total contracted
        // If totalContracted from bids is 0, try to fallback to category.sodBudget sum (legacy)
        if (contractedBidsTotal > 0) {
            totalContracted = contractedBidsTotal;
        } else {
            totalContracted = categories.filter(c => c.status === 'sod').reduce((sum, c) => sum + (c.sodBudget || 0), 0);
        }

        const balance = totalBudget - totalContracted;
        const balanceVsPlan = totalPlanned - totalContracted;

        // Progress based on actual winning bids presence or status
        const sodProgress = categories.length > 0 ? (sodCategoriesCount / categories.length) * 100 : 0;

        const profitableCategories = categoryProfitability.filter(c => c.hasWinningBid && c.isProfitable);
        const unprofitableCategories = categoryProfitability.filter(c => c.hasWinningBid && !c.isProfitable);

        return {
            totalBudget,
            totalContracted,
            totalPlanned,
            balance,
            balanceVsPlan,
            sodProgress,
            categoriesCount: categories.length,
            sodCount: sodCategoriesCount,
            openCount: openCategories.length,
            categories,
            categoryProfitability, // enriched with calculated values
            profitableCategories,
            unprofitableCategories,
            profitableSum: profitableFromBids,
            unprofitableSum: unprofitableFromBids,
            contractedBidsCount,
            contractedBidsTotal
        };
    };

    const metrics = getProjectMetrics();

    // Auto-generate AI on first load
    useEffect(() => {
        if (selectedProject && metrics && aiInsights.length === 0 && !hasGeneratedAI && !isAnalyzing) {
            generateAIAnalysis();
        }
    }, [selectedProject, metrics]);

    // Only reset when project changes, but keep cache per project if needed
    useEffect(() => {
        setAiInsights([]);
        setHasGeneratedAI(false);
    }, [selectedProjectId]);

    // Manual AI generation - now generates multiple insight cards
    const generateAIAnalysis = async () => {
        if (!selectedProject || !metrics) return;

        // Prepare rich data for AI
        const categoriesData = metrics.categoryProfitability.map(c => ({
            title: c.title,
            plan: c.planBudget,
            sod: c.sodBudget, // This is now the calculated actual cost
            diff: c.diffVsPlan,
            status: c.status
        }));

        const projectSummary = [{
            name: selectedProject.title,
            totalBudget: metrics.totalBudget, // Investor budget
            totalPlanned: metrics.totalPlanned, // Internal plan
            totalContracted: metrics.totalContracted, // Actual spend
            balance: metrics.balance, // Required by interface
            balanceVsInvestor: metrics.balance,
            balanceVsPlan: metrics.balanceVsPlan,
            categoriesCount: metrics.categoriesCount,
            sodCount: metrics.sodCount,
            categoriesData: categoriesData // Detailed breakdown
        }];

        // Cache Check
        const cacheKey = `ai_analysis_${selectedProject.id}`;
        const currentSignature = JSON.stringify(projectSummary);

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.signature === currentSignature && parsed.insights?.length > 0) {
                    // console.log('Using cached AI analysis');
                    setAiInsights(parsed.insights);
                    setHasGeneratedAI(true);
                    return;
                }
            }
        } catch (e) {
            console.warn('AI Cache read error', e);
        }

        setIsAnalyzing(true);
        try {
            // Generate overview mode for detailed managerial analysis
            const insights = await generateProjectInsights(projectSummary, 'overview');
            setAiInsights(insights);
            setHasGeneratedAI(true);

            // Save to Cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    signature: currentSignature,
                    insights: insights,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('AI Cache write error', e);
            }

        } catch (error) {
            console.error('AI analysis error:', error);
            setAiInsights([]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Get insight card style based on type
    const getInsightStyle = (type: string) => {
        switch (type) {
            case 'success': return 'from-emerald-900/40 to-green-900/40 border-emerald-500/30';
            case 'warning': return 'from-amber-900/40 to-orange-900/40 border-amber-500/30';
            case 'achievement': return 'from-yellow-900/40 to-orange-900/40 border-yellow-500/30';
            case 'tip': return 'from-cyan-900/40 to-blue-900/40 border-cyan-500/30';
            default: return 'from-blue-900/40 to-indigo-900/40 border-blue-500/30';
        }
    };

    // PDF Export - Professional text-based report
    const handleExportPDF = async () => {
        if (!selectedProject || !metrics) return;

        try {
            const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait for report

            // Add Roboto font for Czech diacritics support
            pdf.addFileToVFS('Roboto-Regular.ttf', RobotoRegularBase64);
            pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            pdf.setFont('Roboto', 'normal');

            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 20;
            const contentWidth = pageWidth - 2 * margin;
            let y = margin;

            // Helper function to add text with word wrap
            const addWrappedText = (text: string, x: number, yPos: number, maxWidth: number, fontSize: number, isBold = false) => {
                pdf.setFontSize(fontSize);
                pdf.setFont('Roboto', 'normal');
                const lines = pdf.splitTextToSize(text, maxWidth);
                pdf.text(lines, x, yPos);
                return yPos + (lines.length * fontSize * 0.4);
            };

            // Header with dark background
            pdf.setFillColor(15, 23, 42); // slate-950
            pdf.rect(0, 0, pageWidth, 40, 'F');

            // TF Logo - larger
            pdf.setFillColor(249, 115, 22); // orange-500
            pdf.roundedRect(margin, 8, 18, 18, 4, 4, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11);
            pdf.setFont('Roboto', 'normal');
            pdf.text('TF', margin + 4.5, 20);

            // Title - main heading
            pdf.setFontSize(16);
            pdf.text('MANAŽERSKÁ ANALÝZA PROJEKTU', margin + 25, 15);

            // Project name
            pdf.setFontSize(11);
            pdf.text(selectedProject.title, margin + 25, 23);

            // Date - right aligned, smaller
            pdf.setFontSize(8);
            pdf.setTextColor(180, 180, 180); // gray
            const dateText = `Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')}`;
            pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), 32);

            y = 50;
            pdf.setTextColor(0, 0, 0);

            // Project Summary Section
            pdf.setFillColor(241, 245, 249); // slate-100
            pdf.rect(margin, y, contentWidth, 32, 'F');

            // Draw border
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, y, contentWidth, 32, 'S');

            y += 7;

            pdf.setFontSize(10);
            pdf.setFont('Roboto', 'normal');
            pdf.text('PŘEHLED PROJEKTU', margin + 5, y);
            y += 7;

            pdf.setFontSize(9);
            const summaryItems = [
                `Celkový rozpočet: ${metrics.totalBudget.toLocaleString('cs-CZ')} Kč`,
                `Zasmluvněno (SOD): ${metrics.totalContracted.toLocaleString('cs-CZ')} Kč`,
                `Bilance: ${metrics.balance.toLocaleString('cs-CZ')} Kč`,
                `Postup SOD: ${metrics.sodCount} z ${metrics.categoriesCount} kategorií (${Math.round(metrics.sodProgress)}%)`
            ];

            pdf.text(summaryItems[0], margin + 5, y);
            pdf.text(summaryItems[1], margin + 90, y);
            y += 5;
            pdf.text(summaryItems[2], margin + 5, y);
            pdf.text(summaryItems[3], margin + 90, y);
            y += 18;

            // AI Analysis Section
            if (aiInsights.length > 0 && aiInsights[0]?.content) {
                // Section header with underline
                pdf.setFontSize(11);
                pdf.setFont('Roboto', 'normal');
                pdf.text('TenderFlow AI', margin, y);
                pdf.setDrawColor(249, 115, 22); // orange
                pdf.setLineWidth(0.5);
                pdf.line(margin, y + 2, margin + 28, y + 2);
                y += 10;

                // Clean and format the AI text - combine section numbers with titles
                let aiText = aiInsights[0].content
                    .replace(/```json\s*/gi, '')
                    .replace(/```\s*/gi, '')
                    .replace(/^\[\s*\{/m, '')
                    .replace(/\}\s*\]\s*$/m, '')
                    .replace(/"hodnoceni"\s*:\s*"/i, '')
                    .replace(/\\n/g, '\n')
                    .replace(/\*\*/g, '')
                    // Combine "1." with "FINANČNÍ ANALÝZA" etc.
                    .replace(/(\d+)\.\s*\n+\s*(FINANČNÍ|SMLUVNÍ|DODAVATEL|CELKOV|SHRNUTÍ)/gi, '$1. $2')
                    .trim();

                // Split into paragraphs
                const paragraphs = aiText.split(/\n\n+/);

                for (const para of paragraphs) {
                    if (!para.trim()) continue;

                    // Check if we need a new page
                    if (y > 270) {
                        pdf.addPage();
                        y = margin;
                    }

                    // Check if it's a section header
                    const isHeader = /^\d+\.\s*(FINANČNÍ|SMLUVNÍ|DODAVATEL|CELKOV|SHRNUTÍ)/i.test(para.trim());

                    if (isHeader) {
                        y += 3; // Extra space before headers
                        pdf.setFontSize(10);
                    } else {
                        pdf.setFontSize(9);
                    }

                    y = addWrappedText(para.trim(), margin, y, contentWidth, pdf.getFontSize()) + 4;
                }
            }

            // Footer
            const totalPages = pdf.internal.pages.length - 1;
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`TenderFlow | Strana ${i} z ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
            }

            pdf.save(`analyza-${selectedProject.title.replace(/\s+/g, '-')}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Chyba při exportu PDF.');
        }
    };

    // Chart data - show ALL categories, not just SOD
    const categoryChartData = metrics?.categories.map(cat => ({
        name: cat.title.length > 12 ? cat.title.substring(0, 12) + '...' : cat.title,
        plán: cat.planBudget || 0,
        SOD: cat.sodBudget || 0,
        rozdíl: (cat.planBudget || 0) - (cat.sodBudget || 0),
        status: cat.status
    })).filter(c => c.plán > 0 || c.SOD > 0) || [];

    // Pie chart for SOD distribution - filter SOD only but fallback to all with planBudget
    const pieChartData = (() => {
        const sodData = metrics?.categories.filter(c => c.status === 'sod' && c.sodBudget > 0) || [];
        if (sodData.length > 0) {
            return sodData.map((cat, idx) => ({
                name: cat.title,
                value: cat.sodBudget || 0,
                color: CHART_COLORS[idx % CHART_COLORS.length]
            }));
        }
        // Fallback: show planned budget distribution
        const planData = metrics?.categories.filter(c => c.planBudget > 0) || [];
        return planData.map((cat, idx) => ({
            name: cat.title,
            value: cat.planBudget || 0,
            color: CHART_COLORS[idx % CHART_COLORS.length]
        }));
    })();

    // Budget overview - always show even without SOD
    const budgetOverviewData = (() => {
        const totalPlanned = metrics?.totalPlanned || 0;
        const totalContracted = metrics?.totalContracted || 0;
        const remaining = totalPlanned - totalContracted;
        return [
            { name: 'Zasmluvněno (SOD)', value: totalContracted, color: '#10B981' },
            { name: 'Zbývá zasmluvnit', value: remaining > 0 ? remaining : 0, color: '#64748b' }
        ].filter(d => d.value > 0);
    })();

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

            <div ref={contentRef} className="p-8 lg:p-10 flex flex-col gap-8 max-w-[1800px] mx-auto w-full">

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

                {/* AI Generation Button */}
                <div className="flex items-center justify-between bg-gradient-to-r from-violet-900/30 to-blue-900/30 backdrop-blur-xl rounded-xl border border-violet-500/20 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-[12px] font-black tracking-tighter">TF</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">TenderFlow AI Analýza</h3>
                            <p className="text-[10px] text-slate-400">
                                {aiInsights.length > 0 ? 'Manažerská analýza projektu' : isAnalyzing ? 'Generuji detailní analýzu...' : 'Automatická analýza projektu'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={generateAIAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                        <span className={`material-symbols-outlined text-[16px] ${isAnalyzing ? 'animate-spin' : ''}`}>
                            {isAnalyzing ? 'sync' : hasGeneratedAI ? 'refresh' : 'auto_awesome'}
                        </span>
                        {isAnalyzing ? 'Generuji...' : hasGeneratedAI ? 'Regenerovat' : 'Generovat AI'}
                    </button>
                </div>

                {/* Main Grid - AI Analysis + Chart side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* AI Analysis - Full formatted text */}
                    <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/20 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-5">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-violet-400 text-[18px]">description</span>
                            Manažerská analýza projektu
                        </h3>
                        {isAnalyzing ? (
                            <div className="flex items-center justify-center h-[350px]">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-xs text-slate-400">Generuji detailní analýzu...</p>
                                </div>
                            </div>
                        ) : aiInsights.length > 0 && aiInsights[0]?.content ? (
                            <div className="max-h-[350px] overflow-y-auto pr-2 text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none
                                prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                                prose-strong:text-white prose-strong:font-semibold
                                prose-ul:my-2 prose-li:my-0.5">
                                <div dangerouslySetInnerHTML={{
                                    __html: aiInsights[0].content
                                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\n- /g, '<br/>• ')
                                        .replace(/\n\n/g, '<br/><br/>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[350px] text-slate-500">
                                <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">psychology</span>
                                <p className="text-xs">AI analýza se generuje automaticky...</p>
                            </div>
                        )}
                    </div>

                    {/* Bar Chart - Plan vs SOD */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-400 text-[18px]">bar_chart</span>
                            Plán vs. Zasmluvněno (SOD)
                        </h3>
                        {categoryChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={categoryChartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => formatMoneyShort(v)} width={60} />
                                    <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                    <Bar dataKey="plán" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="SOD" fill="#10B981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[350px] text-slate-500 text-sm">Žádné SOD kategorie</div>
                        )}
                    </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                    {/* Profitability Pie */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-400 text-[22px]">pie_chart</span>
                            Ziskovost vs Plán
                        </h3>
                        {profitabilityChartData.length > 0 ? (
                            <div className="flex flex-col items-center">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={profitabilityChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                            {profitabilityChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex gap-6 mt-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-slate-300">Ziskové: {formatMoneyShort(metrics?.profitableSum || 0)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <span className="text-slate-300">Ztrátové: {formatMoneyShort(metrics?.unprofitableSum || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[250px]">
                                <span className="material-symbols-outlined text-slate-600 text-[40px] mb-2">
                                    {metrics?.contractedBidsCount > 0 ? 'handshake' : 'hourglass_empty'}
                                </span>
                                <p className="text-slate-500 text-sm text-center">
                                    {metrics?.contractedBidsCount > 0
                                        ? `${metrics.contractedBidsCount} zasmluvněná nabídka`
                                        : 'Zatím žádné zasmluvněné nabídky'}
                                </p>
                                <p className="text-slate-600 text-xs mt-1">
                                    {metrics?.contractedBidsCount > 0
                                        ? `Celkem: ${formatMoneyShort(metrics.contractedBidsTotal)}`
                                        : `Celkový plán: ${formatMoneyShort(metrics?.totalPlanned || 0)}`}
                                </p>
                                <p className="text-slate-700 text-[10px] mt-2">
                                    Označte vítěze jako zasmluvněné v poptávkách
                                </p>
                            </div>
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
                            {metrics?.sodCount > 0 ? 'Rozložení SOD nákladů' : 'Rozložení plánovaného rozpočtu'}
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
