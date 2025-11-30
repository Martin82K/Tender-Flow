
import React from 'react';
import { Header } from './Header';
import { Project, ProjectDetails } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
    projects: Project[];
    projectDetails: Record<string, ProjectDetails>;
}

// --- Helper Functions ---

// Modified to show full precise amount where needed
const formatMoney = (val: number): string => {
    if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M Kč';
    }
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

// New helper for exact amounts
const formatMoneyFull = (val: number): string => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

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

        {/* 2. Global Chart Section */}
        {allProjectsData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Porovnání Rozpočtů vs. Realita</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000000}M`} />
                            <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                formatter={(value: number) => formatMoneyFull(value)}
                            />
                            <Bar dataKey="budget" name="Rozpočet (Investor)" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="contracted" name="Smluvní cena (Náklady)" fill="#607AFB" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
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
