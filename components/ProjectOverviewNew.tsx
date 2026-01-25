import React, { useState, useEffect } from 'react';
import { ProjectDetails, ContractDetails, InvestorFinancials, DemandCategory, Bid } from '../types';

// --- Helper Functions ---
const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;
    const hasM = /M/i.test(valueStr);
    const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr);
    const cleanStr = valueStr.replace(/\s/g, '').replace(/[^0-9,.-]/g, '').replace(',', '.');
    let val = parseFloat(cleanStr);
    if (hasM) val *= 1000000;
    else if (hasK) val *= 1000;
    return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

const formatMoneyFull = (val: number): string => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

interface ProjectOverviewProps {
    project: ProjectDetails;
    onUpdate: (updates: Partial<ProjectDetails>) => void;
    variant?: 'full' | 'compact';
    searchQuery?: string;
    onNavigateToPipeline?: (categoryId: string) => void;
}

export const ProjectOverviewNew: React.FC<ProjectOverviewProps> = ({ project, onUpdate, variant = 'full', searchQuery = '', onNavigateToPipeline }) => {
    const contract = project.contract;
    const investor = project.investorFinancials || { sodPrice: 0, amendments: [] };
    const plannedCost = project.plannedCost || 0;

    // Edit States
    const [editingInfo, setEditingInfo] = useState(false);
    const [editingContract, setEditingContract] = useState(false);
    const [editingInvestor, setEditingInvestor] = useState(false);
    const [editingInternal, setEditingInternal] = useState(false);

    // Filter State for Demand Table
    const [demandFilter, setDemandFilter] = useState<'all' | 'open' | 'closed' | 'sod'>('all');

    // Form States
    const [infoForm, setInfoForm] = useState({
        investor: '',
        technicalSupervisor: '',
        location: '',
        finishDate: '',
        siteManager: '',
        constructionManager: '',
        constructionTechnician: ''
    });

    const [contractForm, setContractForm] = useState<ContractDetails>({
        maturity: 30,
        warranty: 0,
        retention: '',
        siteFacilities: 0,
        insurance: 0
    });

    const [investorForm, setInvestorForm] = useState<InvestorFinancials>({
        sodPrice: 0,
        amendments: []
    });

    const [internalForm, setInternalForm] = useState({
        plannedCost: 0
    });

    // Initialize forms when project changes or edit starts
    useEffect(() => {
        setInfoForm({
            investor: project.investor || '',
            technicalSupervisor: project.technicalSupervisor || '',
            location: project.location || '',
            finishDate: project.finishDate || '',
            siteManager: project.siteManager || '',
            constructionManager: project.constructionManager || '',
            constructionTechnician: project.constructionTechnician || ''
        });
        if (project.contract) {
            setContractForm(project.contract);
        }
        if (project.investorFinancials) {
            setInvestorForm(project.investorFinancials);
        } else {
            setInvestorForm({ sodPrice: 0, amendments: [] });
        }
        setInternalForm({
            plannedCost: project.plannedCost || 0
        });
    }, [project, editingInfo, editingContract, editingInvestor, editingInternal]);

    const handleSaveInfo = () => {
        onUpdate({
            investor: infoForm.investor,
            technicalSupervisor: infoForm.technicalSupervisor,
            location: infoForm.location,
            finishDate: infoForm.finishDate,
            siteManager: infoForm.siteManager,
            constructionManager: infoForm.constructionManager,
            constructionTechnician: infoForm.constructionTechnician
        });
        setEditingInfo(false);
    };

    const handleSaveContract = () => {
        onUpdate({
            contract: contractForm
        });
        setEditingContract(false);
    };

    const handleSaveInvestor = () => {
        onUpdate({
            investorFinancials: investorForm
        });
        setEditingInvestor(false);
    };

    const handleSaveInternal = () => {
        onUpdate({
            plannedCost: internalForm.plannedCost
        });
        setEditingInternal(false);
    };

    // Calculate stats

    // 1. Calculate Total Revenue (Budget) from Investor Contract
    const investorSod = investor.sodPrice || 0;
    const investorAmendmentsTotal = investor.amendments.reduce((sum, a) => sum + (a.price || 0), 0);
    const totalBudget = investorSod + investorAmendmentsTotal;

    // 2. Calculate Total Cost (Contracted Subcontractors) - Sum of ALL winning bid prices (Cena VŘ)
    let totalContractedCost = 0;
    let completedTasks = 0;

    project.categories.forEach(cat => {
        const catBids = project.bids?.[cat.id] || [];
        // Get ALL winning bids (status === 'sod'), not just the first one
        const winningBids = catBids.filter(b => b.status === 'sod');
        if (winningBids.length > 0) {
            // Sum all winning bid prices for this category
            totalContractedCost += winningBids.reduce((sum, bid) => sum + parseMoney(bid.price || '0'), 0);
            completedTasks++;
        }
    });

    const balance = totalBudget - totalContractedCost;
    const plannedBalance = plannedCost > 0 ? plannedCost - totalContractedCost : 0;
    const progress = project.categories.length > 0 ? (completedTasks / project.categories.length) * 100 : 0;

    // Handlers for Investor Form
    const addAmendment = () => {
        setInvestorForm(prev => ({
            ...prev,
            amendments: [...prev.amendments, { id: `a${Date.now()}`, label: `Dodatek č.${prev.amendments.length + 1}`, price: 0 }]
        }));
    };

    const updateAmendment = (index: number, field: 'label' | 'price', value: string | number) => {
        const newAmendments = [...investorForm.amendments];
        newAmendments[index] = { ...newAmendments[index], [field]: value };
        setInvestorForm({ ...investorForm, amendments: newAmendments });
    };

    const removeAmendment = (index: number) => {
        const newAmendments = investorForm.amendments.filter((_, i) => i !== index);
        setInvestorForm({ ...investorForm, amendments: newAmendments });
    };

    const renderCompactDetails = () => (
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">info</span>
                Základní informace o stavbě
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 text-sm">

                {/* 1. Investor & Info */}
                <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Údaje o stavbě</span>
                        <button onClick={() => setEditingInfo(true)} className="text-slate-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Investor:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">{project.investor || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Lokace:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">{project.location || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Termín:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">{project.finishDate || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Hl. stavbyvedoucí:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">{project.siteManager || '-'}</span>
                        </div>
                    </div>
                    {editingInfo && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Upravit informace</h3>
                                <div className="space-y-4">
                                    <div><label className="text-xs text-slate-500 font-bold mb-1.5 block">Investor</label><input value={infoForm.investor} onChange={e => setInfoForm({ ...infoForm, investor: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" /></div>
                                    <div><label className="text-xs text-slate-500 font-bold mb-1.5 block">Lokace</label><input value={infoForm.location} onChange={e => setInfoForm({ ...infoForm, location: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" /></div>
                                    <div><label className="text-xs text-slate-500 font-bold mb-1.5 block">Termín</label><input value={infoForm.finishDate} onChange={e => setInfoForm({ ...infoForm, finishDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" /></div>
                                    <div><label className="text-xs text-slate-500 font-bold mb-1.5 block">Hl. stavbyvedoucí</label><input value={infoForm.siteManager} onChange={e => setInfoForm({ ...infoForm, siteManager: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" /></div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button onClick={() => setEditingInfo(false)} className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm">Zrušit</button>
                                        <button onClick={handleSaveInfo} className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm">Uložit změny</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Financials (Investor) */}
                <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Finance (Investor)</span>
                        <button onClick={() => setEditingInvestor(true)} className="text-slate-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">SOD Cena:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">{formatMoney(investor.sodPrice)}</span>
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span className="font-extrabold text-xs">Celkem:</span>
                            <span className="font-extrabold text-xs">{formatMoney(totalBudget)}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Internal Budget */}
                <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Interní Rozpočet</span>
                        <button onClick={() => setEditingInternal(true)} className="text-slate-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Plán (Cíl):</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">{plannedCost > 0 ? formatMoney(plannedCost) : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-500 text-xs">Zasmluvněno:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">{formatMoney(totalContractedCost)}</span>
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
                        <div className="flex justify-between">
                            <span className={`font-extrabold text-xs ${plannedBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Rezerva:</span>
                            <span className={`font-extrabold text-xs ${plannedBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{plannedBalance >= 0 ? '+' : ''}{formatMoney(plannedBalance)}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Progress */}
                <div className="lg:col-span-1">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Postup</span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tighter">Zasmluvněné subdodávky</span>
                            <span className="text-primary text-sm font-black">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-1000 ease-out shadow-sm"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">Dokončeno {completedTasks} z {project.categories.length} kategorií</p>
                    </div>
                </div>

            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8 w-full bg-slate-50 dark:bg-slate-950 animate-fadeIn">
            {/* Top Row: 4 KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Rozpočet (Investor) */}
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <div className="absolute -top-4 -right-4 size-24 bg-blue-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500">
                                <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">Rozpočet</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">{formatMoneyFull(totalBudget)}</div>
                            <p className="text-[10px] text-slate-500 font-medium">Celkový příjem od investora</p>
                        </div>
                    </div>
                </div>

                {/* 2. Plánovaný Náklad */}
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <div className="absolute -top-4 -right-4 size-24 bg-indigo-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-500">
                                <span className="material-symbols-outlined text-2xl">analytics</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">Plán nákladů</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">{plannedCost > 0 ? formatMoneyFull(plannedCost) : '-'}</div>
                            <p className="text-[10px] text-slate-500 font-medium">Interní cílový náklad stavby</p>
                        </div>
                    </div>
                </div>

                {/* 3. Zasmluvněno */}
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <div className="absolute -top-4 -right-4 size-24 bg-emerald-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
                                <span className="material-symbols-outlined text-2xl">handshake</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">Zasmluvněno</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none mb-2">{formatMoneyFull(totalContractedCost)}</div>
                            <div className="flex items-center gap-1.5">
                                <span className={`size-1.5 rounded-full ${plannedBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                <p className={`text-[10px] font-bold ${plannedBalance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    Rezerva: {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Postup Zadávání */}
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <div className="absolute -top-4 -right-4 size-24 bg-amber-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-1.5 rounded-full border-4 border-amber-500/20 border-t-amber-500 size-10 flex items-center justify-center">
                                <span className="text-[10px] font-black text-amber-500">{Math.round((completedTasks / project.categories.length) * 100)}%</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">Postup VŘ</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">{completedTasks} / {project.categories.length}</div>
                            <p className="text-[10px] text-slate-500 font-medium">Hotové subdodavatelské balíčky</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Grid: Conditional Render */}
            {variant === 'compact' ? renderCompactDetails() : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


                    {/* Column 1: Informace o stavbě */}
                    <div className="flex flex-col">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informace o stavbě</h3>
                                {!editingInfo ? (
                                    <button onClick={() => setEditingInfo(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveInfo} className="text-emerald-400 hover:text-emerald-300">
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        </button>
                                        <button onClick={() => setEditingInfo(false)} className="text-red-400 hover:text-red-300">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!editingInfo ? (
                                <div className="space-y-3">
                                    {[
                                        { label: 'Investor', value: project.investor, icon: 'corporate_fare', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                        { label: 'Technický dozor', value: project.technicalSupervisor, icon: 'visibility', color: 'text-violet-500', bg: 'bg-violet-500/10' },
                                        { label: 'Lokace', value: project.location, icon: 'location_on', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                        { label: 'Termín dokončení', value: project.finishDate, icon: 'calendar_today', color: 'text-orange-500', bg: 'bg-orange-500/10' },
                                        { label: 'Hlavní stavbyvedoucí', value: project.siteManager, icon: 'person', color: 'text-cyan-500', bg: 'bg-cyan-500/10' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-900 transition-all">
                                            <div className={`p-2 ${item.bg} ${item.color} rounded-xl`}>
                                                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] uppercase text-slate-400 font-extrabold tracking-widest leading-none mb-1">{item.label}</div>
                                                <div className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{item.value || '—'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {/* Edit Form for Info */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Investor</label>
                                        <input type="text" value={infoForm.investor} onChange={e => setInfoForm({ ...infoForm, investor: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Technický dozor</label>
                                        <input type="text" value={infoForm.technicalSupervisor} onChange={e => setInfoForm({ ...infoForm, technicalSupervisor: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div className="h-px bg-slate-800 my-1"></div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Lokace</label>
                                        <input type="text" value={infoForm.location} onChange={e => setInfoForm({ ...infoForm, location: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Termín dokončení</label>
                                        <input type="text" value={infoForm.finishDate} onChange={e => setInfoForm({ ...infoForm, finishDate: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Hlavní stavbyvedoucí</label>
                                        <input type="text" value={infoForm.siteManager} onChange={e => setInfoForm({ ...infoForm, siteManager: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Stavbyvedoucí</label>
                                        <input type="text" value={infoForm.constructionManager} onChange={e => setInfoForm({ ...infoForm, constructionManager: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Stavební technik</label>
                                        <input type="text" value={infoForm.constructionTechnician} onChange={e => setInfoForm({ ...infoForm, constructionTechnician: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Financials */}
                    <div className="flex flex-col gap-6">
                        {/* Smlouva s investorem */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-400">account_balance_wallet</span>
                                    Smlouva s investorem
                                </h3>
                                {!editingInvestor ? (
                                    <button onClick={() => setEditingInvestor(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveInvestor} className="text-emerald-400 hover:text-emerald-300">
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        </button>
                                        <button onClick={() => setEditingInvestor(false)} className="text-red-400 hover:text-red-300">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!editingInvestor ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">SOD Základ</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{formatMoneyFull(investor.sodPrice)}</span>
                                    </div>

                                    {investor.amendments.map((amendment, idx) => (
                                        <div key={amendment.id} className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest truncate max-w-[140px]">{amendment.label}</span>
                                            <span className="font-bold text-slate-900 dark:text-white text-xs">{formatMoneyFull(amendment.price)}</span>
                                        </div>
                                    ))}

                                    <div className="flex justify-between items-center pt-4 px-3">
                                        <span className="text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-widest">CELKEM</span>
                                        <span className="text-base font-black text-emerald-500">{formatMoneyFull(totalBudget)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Základní cena SOD</label>
                                        <input
                                            type="number"
                                            value={investorForm.sodPrice}
                                            onChange={e => setInvestorForm({ ...investorForm, sodPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-2 text-sm text-white font-semibold text-right"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-500 mb-1 block">Dodatky</label>
                                        {investorForm.amendments.map((amendment, idx) => (
                                            <div key={amendment.id} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={amendment.label}
                                                    onChange={e => updateAmendment(idx, 'label', e.target.value)}
                                                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-white"
                                                    placeholder="Název"
                                                />
                                                <input
                                                    type="number"
                                                    value={amendment.price}
                                                    onChange={e => updateAmendment(idx, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-28 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                                                />
                                                <button onClick={() => removeAmendment(idx)} className="text-red-400 hover:text-red-600">
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                        <button onClick={addAmendment} className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-2 font-medium">
                                            <span className="material-symbols-outlined text-[16px]">add</span>
                                            Přidat dodatek
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Interní Rozpočet */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400">savings</span>
                                    Interní Rozpočet
                                </h3>
                                {!editingInternal ? (
                                    <button onClick={() => setEditingInternal(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveInternal} className="text-emerald-400 hover:text-emerald-300">
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        </button>
                                        <button onClick={() => setEditingInternal(false)} className="text-red-400 hover:text-red-300">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!editingInternal ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Plánovaný náklad</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{plannedCost > 0 ? formatMoneyFull(plannedCost) : 'Nezadáno'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Zasmluvněno</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{formatMoneyFull(totalContractedCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 px-3">
                                        <span className="text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-widest">AKTUÁLNÍ REZERVA</span>
                                        <span className={`text-base font-black ${plannedBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Plánovaný náklad (Cíl)</label>
                                        <input
                                            type="number"
                                            value={internalForm.plannedCost}
                                            onChange={e => setInternalForm({ ...internalForm, plannedCost: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-2 text-sm text-slate-900 dark:text-white font-semibold text-right focus:border-emerald-500/50 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Contract Parameters */}
                    <div className="flex flex-col">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-400">gavel</span>
                                    Parametry smlouvy
                                </h3>
                                {contract && !editingContract ? (
                                    <button onClick={() => setEditingContract(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                ) : contract && (
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveContract} className="text-emerald-400 hover:text-emerald-300">
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        </button>
                                        <button onClick={() => setEditingContract(false)} className="text-red-400 hover:text-red-300">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {contract && !editingContract ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Splatnost</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{contract.maturity} dní</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Záruka</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{contract.warranty} měsíců</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Pozastávka</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{contract.retention}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Zařízení staveniště</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{contract.siteFacilities} %</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Pojištění</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{contract.insurance} %</span>
                                    </div>
                                </div>
                            ) : contract ? (
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Splatnost (dní)</label>
                                        <input
                                            type="number"
                                            value={contractForm.maturity}
                                            onChange={e => setContractForm({ ...contractForm, maturity: parseInt(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Záruka (měsíců)</label>
                                        <input
                                            type="number"
                                            value={contractForm.warranty}
                                            onChange={e => setContractForm({ ...contractForm, warranty: parseInt(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pozastávka</label>
                                        <input
                                            type="text"
                                            value={contractForm.retention}
                                            onChange={e => setContractForm({ ...contractForm, retention: e.target.value })}
                                            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Zař. staveniště (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.siteFacilities}
                                            onChange={e => setContractForm({ ...contractForm, siteFacilities: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pojištění (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.insurance}
                                            onChange={e => setContractForm({ ...contractForm, insurance: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Demand Categories Overview Table */}
            {project.categories.length > 0 && (() => {
                // Helper function to check if a category has signed contracts
                const hasContracts = (cat: typeof project.categories[0]) => {
                    const catBids = project.bids?.[cat.id] || [];
                    // Match table logic: Must be a winning bid (status='sod') AND have contracted flag (truthy)
                    return catBids.some(b => b.status === 'sod' && b.contracted);
                };

                // Filter categories based on selected filter AND search query
                const filteredCategories = project.categories.filter(cat => {
                    // First apply status filter
                    let matchesFilter = true;
                    if (demandFilter === 'all') matchesFilter = true;
                    else if (demandFilter === 'open') matchesFilter = cat.status === 'open' && !hasContracts(cat);
                    else if (demandFilter === 'closed') matchesFilter = cat.status === 'closed' && !hasContracts(cat);
                    else if (demandFilter === 'sod') matchesFilter = hasContracts(cat);

                    if (!matchesFilter) return false;

                    // Then apply search query filter
                    if (!searchQuery || searchQuery.trim() === '') return true;

                    const query = searchQuery.toLowerCase();
                    const catBids = project.bids?.[cat.id] || [];
                    const winningBids = catBids.filter(b => b.status === 'sod');
                    const winnersNames = winningBids.map(w => w.companyName).join(' ').toLowerCase();

                    // Search in: category title, description, winner names
                    return (
                        cat.title.toLowerCase().includes(query) ||
                        cat.description?.toLowerCase().includes(query) ||
                        winnersNames.includes(query)
                    );
                });

                // Count for each filter - "sod" counts categories with actual contracts
                const sodCount = project.categories.reduce((acc, cat) => {
                    const catBids = project.bids?.[cat.id] || [];
                    return acc + catBids.filter(b => b.status === 'sod' && b.contracted).length;
                }, 0);
                const openCount = project.categories.filter(c => c.status === 'open' && !hasContracts(c)).length;
                const closedCount = project.categories.filter(c => c.status === 'closed' && !hasContracts(c)).length;
                const allCount = project.categories.length;

                return (
                    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl mt-8 shadow-sm">
                        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                    <span className="material-symbols-outlined text-2xl">table_chart</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">Přehled Poptávek</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Detailní rozpis balíčků</p>
                                </div>
                            </div>

                            {/* Filter Buttons */}
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setDemandFilter('all')}
                                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${demandFilter === 'all'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Vše ({allCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('open')}
                                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${demandFilter === 'open'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Poptávané ({openCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('closed')}
                                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${demandFilter === 'closed'
                                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Ukončené ({closedCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('sod')}
                                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${demandFilter === 'sod'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Zasmluvněné ({sodCount})
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Stav</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Poptávka</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">SOD</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">Plán</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">Cena VŘ</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">Rozdíl</th>
                                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-center">Dodavatel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {[...filteredCategories].sort((a, b) => a.title.localeCompare(b.title, 'cs')).map(cat => {
                                        const catBids = project.bids?.[cat.id] || [];
                                        const winningBids = catBids.filter(b => b.status === 'sod');
                                        const subPrice = winningBids.reduce((sum, bid) => sum + parseMoney(bid.price || '0'), 0);
                                        const diffPlan = cat.planBudget - subPrice;
                                        const hasWinner = winningBids.length > 0;
                                        const winnersNames = winningBids.map(w => w.companyName).join(', ');

                                        const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                                            'open': { label: 'Poptávka', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                                            'negotiating': { label: 'Jednání', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
                                            'closed': { label: 'Uzavřeno', bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' },
                                            'sod': { label: 'Smluvně', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' }
                                        };
                                        const status = statusConfig[cat.status] || statusConfig['open'];

                                        return (
                                            <tr
                                                key={cat.id}
                                                className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                                                onClick={() => onNavigateToPipeline?.(cat.id)}
                                            >
                                                <td className="py-4 px-6">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${status.bg} ${status.text} text-[10px] font-black uppercase tracking-tighter border border-current opacity-80 group-hover:opacity-100 transition-opacity`}>
                                                        <span className={`size-1.5 rounded-full ${status.dot} animate-pulse`}></span>
                                                        {status.label}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">{cat.title}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">Nabídky: {catBids.length}</div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-slate-500 dark:text-slate-400 text-xs">{formatMoney(cat.sodBudget)}</td>
                                                <td className="py-4 px-6 text-right font-bold text-slate-900 dark:text-slate-200 text-xs">{formatMoney(cat.planBudget)}</td>
                                                <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                                                    {hasWinner ? formatMoney(subPrice) : <span className="text-slate-300 dark:text-slate-700">---</span>}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    {hasWinner ? (
                                                        <div className={`inline-flex items-center gap-1 font-black text-xs ${diffPlan >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {diffPlan >= 0 ? '+' : ''}{formatMoney(diffPlan)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700">-</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 max-w-[200px] truncate">
                                                    {hasWinner ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                                {winnersNames.charAt(0)}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">{winnersNames}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Nepřiřazeno</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100/50 dark:bg-slate-900/50 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-800">
                                        <td colSpan={2} className="py-6 px-8 text-right text-[11px] uppercase tracking-widest text-slate-500">Celková bilance</td>
                                        <td className="py-6 px-6 text-right text-xs text-slate-400">{formatMoney(project.categories.reduce((acc, c) => acc + (c.sodBudget || 0), 0))}</td>
                                        <td className="py-6 px-6 text-right text-xs text-slate-600 dark:text-slate-300">{formatMoney(project.categories.reduce((acc, c) => acc + (c.planBudget || 0), 0))}</td>
                                        <td className="py-6 px-6 text-right text-sm">{formatMoney(project.categories.reduce((sum, cat) => {
                                            const catBids = project.bids?.[cat.id] || [];
                                            const winningBids = catBids.filter(b => b.status === 'sod');
                                            return sum + winningBids.reduce((s, b) => s + parseMoney(b.price || '0'), 0);
                                        }, 0))}</td>
                                        <td className="py-6 px-6 text-right">
                                            {(() => {
                                                const total = project.categories.reduce((sum, cat) => {
                                                    const catBids = project.bids?.[cat.id] || [];
                                                    const winningBids = catBids.filter(b => b.status === 'sod');
                                                    if (winningBids.length === 0) return sum + 0;
                                                    const subPrice = winningBids.reduce((s, b) => s + parseMoney(b.price || '0'), 0);
                                                    return sum + (cat.planBudget - subPrice);
                                                }, 0);
                                                return <span className={`text-sm ${total >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{total >= 0 ? '+' : ''}{formatMoney(total)}</span>;
                                            })()}
                                        </td>
                                        <td className="py-6 px-6"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                );
            })()}
        </div >
    );
};
