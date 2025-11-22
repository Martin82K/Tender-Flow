
import React from 'react';
import { Header } from './Header';
import { PROJECTS_DB, INITIAL_BIDS } from '../data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Helper Functions ---

const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;
    const cleanStr = valueStr.replace(/[^0-9,.]/g, '').replace(',', '.');
    let val = parseFloat(cleanStr);
    
    if (valueStr.includes('M')) {
        val *= 1000000;
    } else if (valueStr.includes('k') || valueStr.includes('K')) {
        val *= 1000;
    }
    
    return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
    if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M Kč';
    }
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

// --- Logic to aggregate data ---

interface ProjectFinancials {
    id: string;
    name: string;
    totalBudget: number;
    totalContracted: number;
    categories: {
        name: string;
        budget: number;
        winningBid: number;
        winningBidder: string | null;
    }[];
}

const getProjectData = (projectId: string): ProjectFinancials => {
    const project = PROJECTS_DB[projectId];
    if (!project) return { id: projectId, name: 'Unknown', totalBudget: 0, totalContracted: 0, categories: [] };

    let totalBudget = 0;
    let totalContracted = 0;
    const categories = [];

    for (const cat of project.categories) {
        const budget = parseMoney(cat.budget);
        totalBudget += budget;

        const bids = INITIAL_BIDS[cat.id] || [];
        const winningBid = bids.find(b => b.status === 'sod');
        const winningAmount = winningBid ? parseMoney(winningBid.price || '0') : 0;
        totalContracted += winningAmount;

        categories.push({
            name: cat.title,
            budget: budget,
            winningBid: winningAmount,
            winningBidder: winningBid ? winningBid.companyName : null
        });
    }

    return {
        id: projectId,
        name: project.title,
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

const ProjectCard: React.FC<{ projectId: string }> = ({ projectId }) => {
    const data = getProjectData(projectId);
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
                        {diff >= 0 ? 'Úspora' : 'Nad rozpočet'}
                    </span>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4 bg-white dark:bg-slate-900">
                <div>
                     <p className="text-xs text-slate-500 uppercase tracking-wider">Budget</p>
                     <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{formatMoney(data.totalBudget)}</p>
                </div>
                <div className="text-right">
                     <p className="text-xs text-slate-500 uppercase tracking-wider">Zasmluvněno</p>
                     <p className="text-lg font-bold text-primary">{formatMoney(data.totalContracted)}</p>
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
                             {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                        </p>
                     </div>
                 </div>
            </div>

            {/* Categories Expandable/List */}
            <div className="border-t border-slate-100 dark:border-slate-800">
                 <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 uppercase flex justify-between">
                     <span>Kategorie</span>
                     <span>Stav</span>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                    {data.categories.map((cat, idx) => {
                        const hasWinner = cat.winningBid > 0;
                        const catDiff = cat.budget - cat.winningBid;
                        return (
                            <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{cat.name}</p>
                                    {cat.winningBidder && <p className="text-xs text-slate-500">{cat.winningBidder}</p>}
                                </div>
                                <div className="text-right">
                                    {hasWinner ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatMoney(cat.winningBid)}</span>
                                            <span className={`text-[10px] ${catDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {catDiff >= 0 ? 'Ušetřeno' : 'Navíc'} {formatMoney(Math.abs(catDiff))}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">V řešení</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                 </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const projectIds = Object.keys(PROJECTS_DB);
  
  // Global Stats Calculation
  const allProjectsData = projectIds.map(getProjectData);
  
  const totalBudget = allProjectsData.reduce((acc, curr) => acc + curr.totalBudget, 0);
  const totalContracted = allProjectsData.reduce((acc, curr) => acc + curr.totalContracted, 0);
  const totalProjects = projectIds.length;
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
                title="Celkový Rozpočet" 
                value={formatMoney(totalBudget)} 
                icon="account_balance_wallet" 
                color="bg-slate-500" 
                subtitle="Součet vysoutěžených cen"
            />
            <KPICard 
                title="Zasmluvněno (SOD)" 
                value={formatMoney(totalContracted)} 
                icon="handshake" 
                color="bg-primary" 
                subtitle="Aktuální smluvní ceny"
            />
             <KPICard 
                title="Bilance Úspor" 
                value={(totalBalance >= 0 ? '+' : '') + formatMoney(totalBalance)} 
                icon="savings" 
                color={totalBalance >= 0 ? "bg-green-500" : "bg-red-500"}
                subtitle={totalBalance >= 0 ? "Pod rozpočtem" : "Překročení rozpočtu"}
            />
        </div>

        {/* 2. Global Chart Section */}
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
                            formatter={(value: number) => formatMoney(value)}
                        />
                        <Bar dataKey="budget" name="Rozpočet" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                        <Bar dataKey="contracted" name="Smluvní cena" fill="#607AFB" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* 3. Project Detail Grid */}
        <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">view_module</span>
                Detailní přehled staveb
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {projectIds.map(id => (
                    <ProjectCard key={id} projectId={id} />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
