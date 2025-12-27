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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">info</span>
                Základní informace o stavbě
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-sm">

                {/* 1. Investor & Info */}
                <div className="lg:col-span-1 border-r border-slate-800/50 pr-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Údaje o stavbě</span>
                        <button onClick={() => setEditingInfo(true)} className="text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Investor:</span>
                            <span className="text-white font-medium">{project.investor || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Lokace:</span>
                            <span className="text-white font-medium">{project.location || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Termín:</span>
                            <span className="text-white font-medium">{project.finishDate || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Hl. stavbyvedoucí:</span>
                            <span className="text-white font-medium">{project.siteManager || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Stavbyvedoucí:</span>
                            <span className="text-white font-medium">{project.constructionManager || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Technik:</span>
                            <span className="text-white font-medium">{project.constructionTechnician || '-'}</span>
                        </div>
                    </div>
                    {/* Edit Modal for Info - Reusing existing state/logic via a Portal or inline if simple, but here just inline conditional for simplicity if needed, OR keeping it read-only mostly in compact and opening modal? 
                     For now, let's keep the existing inline editing logic but adapted for this view, OR simple switch to expanded view?
                     Actually, to keep it simple and reusing the complex forms, maybe we just perform inline replacement like the big view but more compact?
                     Let's use the existing editingInfo state. */}
                    {editingInfo && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4">Upravit informace</h3>
                                <div className="space-y-3">
                                    {/* Simplified Form Fields */}
                                    <div><label className="text-xs text-slate-500 block mb-1">Investor</label><input value={infoForm.investor} onChange={e => setInfoForm({ ...infoForm, investor: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Lokace</label><input value={infoForm.location} onChange={e => setInfoForm({ ...infoForm, location: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Termín</label><input value={infoForm.finishDate} onChange={e => setInfoForm({ ...infoForm, finishDate: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Hl. stavbyvedoucí</label><input value={infoForm.siteManager} onChange={e => setInfoForm({ ...infoForm, siteManager: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Stavbyvedoucí</label><input value={infoForm.constructionManager} onChange={e => setInfoForm({ ...infoForm, constructionManager: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Technik</label><input value={infoForm.constructionTechnician} onChange={e => setInfoForm({ ...infoForm, constructionTechnician: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setEditingInfo(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Zrušit</button>
                                        <button onClick={handleSaveInfo} className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500">Uložit</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Financials (Investor) */}
                <div className="lg:col-span-1 border-r border-slate-800/50 pr-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Finance (Investor)</span>
                        {!editingInvestor ? (
                            <button onClick={() => setEditingInvestor(true)} className="text-slate-500 hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={handleSaveInvestor} className="text-emerald-400 hover:text-emerald-300">
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                </button>
                                <button onClick={() => setEditingInvestor(false)} className="text-red-400 hover:text-red-300">
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">SOD Cena:</span>
                            <span className="text-white font-semibold">{formatMoney(investor.sodPrice)}</span>
                        </div>
                        {investor.amendments.map((amendment) => (
                            <div key={amendment.id} className="flex justify-between">
                                <span className="text-slate-400">{amendment.label}:</span>
                                <span className="text-white font-medium">{formatMoney(amendment.price || 0)}</span>
                            </div>
                        ))}
                        <div className="h-px bg-slate-800 my-1"></div>
                        <div className="flex justify-between text-emerald-400">
                            <span className="font-bold">Celkem:</span>
                            <span className="font-bold">{formatMoney(totalBudget)}</span>
                        </div>
                    </div>
                    {editingInvestor && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4">Upravit finance</h3>
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Základní cena SOD</label>
                                        <input
                                            type="number"
                                            value={investorForm.sodPrice}
                                            onChange={e => setInvestorForm({ ...investorForm, sodPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white font-semibold text-right"
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
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                                                    placeholder="Název"
                                                />
                                                <input
                                                    type="number"
                                                    value={amendment.price}
                                                    onChange={e => updateAmendment(idx, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white text-right"
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
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setEditingInvestor(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Zrušit</button>
                                        <button onClick={handleSaveInvestor} className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500">Uložit</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Internal Budget */}
                <div className="lg:col-span-1 border-r border-slate-800/50 pr-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Interní Rozpočet</span>
                        <button onClick={() => setEditingInternal(true)} className="text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Plán (Cíl):</span>
                            <span className="text-white font-semibold">{plannedCost > 0 ? formatMoney(plannedCost) : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Zasmluvněno:</span>
                            <span className="text-white font-semibold">{formatMoney(totalContractedCost)}</span>
                        </div>
                        <div className="h-px bg-slate-800 my-1"></div>
                        <div className="flex justify-between">
                            <span className={`font-bold ${plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Rezerva:</span>
                            <span className={`font-bold ${plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{plannedBalance >= 0 ? '+' : ''}{formatMoney(plannedBalance)}</span>
                        </div>
                    </div>
                    {editingInternal && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4">Upravit rozpočet</h3>
                                <div><label className="text-xs text-slate-500 block mb-1">Plánovaný náklad</label><input type="number" value={internalForm.plannedCost} onChange={e => setInternalForm({ ...internalForm, plannedCost: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => setEditingInternal(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Zrušit</button>
                                    <button onClick={handleSaveInternal} className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500">Uložit</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Contract Params */}
                <div className="lg:col-span-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Parametry Smlouvy</span>
                        <button onClick={() => setEditingContract(true)} className="text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Splatnost:</span>
                            <span className="text-white font-medium">{project.contract?.maturity ?? 30} dní</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Záruka:</span>
                            <span className="text-white font-medium">{project.contract?.warranty || 0} měsíců</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Pozastávka:</span>
                            <span className="text-white font-medium">{project.contract?.retention || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Zařízení staveniště:</span>
                            <span className="text-white font-medium">{project.contract?.siteFacilities || 0} %</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Podíl na pojištění:</span>
                            <span className="text-white font-medium">{project.contract?.insurance || 0} %</span>
                        </div>
                    </div>
                    {editingContract && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4">Upravit smlouvu</h3>
                                <div className="space-y-3">
                                    <div><label className="text-xs text-slate-500 block mb-1">Splatnost (dní)</label><input type="number" value={contractForm.maturity} onChange={e => setContractForm({ ...contractForm, maturity: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Záruka (měsíců)</label><input type="number" value={contractForm.warranty} onChange={e => setContractForm({ ...contractForm, warranty: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Pozastávka</label><input type="text" value={contractForm.retention} onChange={e => setContractForm({ ...contractForm, retention: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Zař. staveniště (%)</label><input type="number" step="0.1" value={contractForm.siteFacilities} onChange={e => setContractForm({ ...contractForm, siteFacilities: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block mb-1">Pojištění (%)</label><input type="number" step="0.1" value={contractForm.insurance} onChange={e => setContractForm({ ...contractForm, insurance: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" /></div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setEditingContract(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Zrušit</button>
                                        <button onClick={handleSaveContract} className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500">Uložit</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 p-6 min-h-full bg-slate-950">
            {/* Top Row: 4 KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* 1. Rozpočet (Investor) */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-blue-500">account_balance_wallet</span>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <span className="material-symbols-outlined text-blue-400 text-xl">payments</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">ROZPOČET (INVESTOR)</div>
                            <div className="text-2xl font-bold text-white tracking-tight">{formatMoneyFull(totalBudget)}</div>
                            <div className="text-[10px] text-slate-500 mt-1">Příjem (SOD + Dodatky)</div>
                        </div>
                    </div>
                </div>

                {/* 2. Plánovaný Náklad */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-indigo-500">analytics</span>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <span className="material-symbols-outlined text-indigo-400 text-xl">bar_chart</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">PLÁNOVANÝ NÁKLAD</div>
                            <div className="text-2xl font-bold text-white tracking-tight">{plannedCost > 0 ? formatMoneyFull(plannedCost) : '-'}</div>
                            <div className="text-[10px] text-slate-500 mt-1">Interní cíl nákladů</div>
                        </div>
                    </div>
                </div>

                {/* 3. Zasmluvněno */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-emerald-500">handshake</span>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <span className="material-symbols-outlined text-emerald-400 text-xl">trending_up</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">ZASMLUVNĚNO</div>
                            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{formatMoneyFull(totalContractedCost)}</div>
                            <div className="text-[10px] text-emerald-500/80 mt-1 font-medium">Zbývá: {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}</div>
                        </div>
                    </div>
                </div>

                {/* 4. Postup Zadávání */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-amber-500">check_circle</span>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                <span className="material-symbols-outlined text-amber-400 text-xl">auto_awesome</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">POSTUP ZADÁVÁNÍ</div>
                            <div className="text-2xl font-bold text-white tracking-tight">{completedTasks} / {project.categories.length}</div>
                            <div className="text-[10px] text-slate-500 mt-1">Hotové subdodávky</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Grid: Conditional Render */}
            {variant === 'compact' ? renderCompactDetails() : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


                    {/* Column 1: Informace o stavbě */}
                    <div className="flex flex-col">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Informace o stavbě</h3>
                                {!editingInfo ? (
                                    <button onClick={() => setEditingInfo(true)} className="text-slate-500 hover:text-white transition-colors">
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
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-blue-400 text-xl mt-1">corporate_fare</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Investor</div>
                                            <div className="text-sm font-bold text-white">{project.investor || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-violet-400 text-xl mt-1">visibility</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Technický dozor</div>
                                            <div className="text-sm font-bold text-white">{project.technicalSupervisor || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-emerald-400 text-xl mt-1">location_on</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Lokace</div>
                                            <div className="text-sm font-bold text-white">{project.location || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-orange-400 text-xl mt-1">calendar_today</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Termín dokončení</div>
                                            <div className="text-sm font-bold text-white">{project.finishDate || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-cyan-400 text-xl mt-1">person</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Hlavní stavbyvedoucí</div>
                                            <div className="text-sm font-bold text-white">{project.siteManager || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-fuchsia-400 text-xl mt-1">engineering</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Stavbyvedoucí</div>
                                            <div className="text-sm font-bold text-white">{project.constructionManager || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                        <span className="material-symbols-outlined text-rose-400 text-xl mt-1">handyman</span>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500 font-semibold">Stavební technik</div>
                                            <div className="text-sm font-bold text-white">{project.constructionTechnician || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {/* Edit Form for Info */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Investor</label>
                                        <input type="text" value={infoForm.investor} onChange={e => setInfoForm({ ...infoForm, investor: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Technický dozor</label>
                                        <input type="text" value={infoForm.technicalSupervisor} onChange={e => setInfoForm({ ...infoForm, technicalSupervisor: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div className="h-px bg-slate-800 my-1"></div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Lokace</label>
                                        <input type="text" value={infoForm.location} onChange={e => setInfoForm({ ...infoForm, location: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Termín dokončení</label>
                                        <input type="text" value={infoForm.finishDate} onChange={e => setInfoForm({ ...infoForm, finishDate: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Hlavní stavbyvedoucí</label>
                                        <input type="text" value={infoForm.siteManager} onChange={e => setInfoForm({ ...infoForm, siteManager: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Stavbyvedoucí</label>
                                        <input type="text" value={infoForm.constructionManager} onChange={e => setInfoForm({ ...infoForm, constructionManager: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Stavební technik</label>
                                        <input type="text" value={infoForm.constructionTechnician} onChange={e => setInfoForm({ ...infoForm, constructionTechnician: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Financials */}
                    <div className="flex flex-col gap-6">
                        {/* Smlouva s investorem */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-400">account_balance_wallet</span>
                                    Smlouva s investorem
                                </h3>
                                {!editingInvestor ? (
                                    <button onClick={() => setEditingInvestor(true)} className="text-slate-500 hover:text-white transition-colors">
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
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Základní SOD</span>
                                        <span className="font-bold text-white">{formatMoneyFull(investor.sodPrice)}</span>
                                    </div>

                                    {investor.amendments.map((amendment, idx) => (
                                        <div key={amendment.id} className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                            <span className="text-slate-400 text-sm font-medium">{amendment.label}</span>
                                            <span className="font-bold text-white">{formatMoneyFull(amendment.price)}</span>
                                        </div>
                                    ))}

                                    <div className="flex justify-between items-center pt-4 mt-2">
                                        <span className="text-slate-400 text-sm font-bold uppercase">CELKEM BEZ DPH</span>
                                        <span className="text-lg font-bold text-emerald-400">{formatMoneyFull(totalBudget)}</span>
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
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-sm text-white font-semibold text-right"
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
                                                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white"
                                                    placeholder="Název"
                                                />
                                                <input
                                                    type="number"
                                                    value={amendment.price}
                                                    onChange={e => updateAmendment(idx, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
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
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400">savings</span>
                                    Interní Rozpočet
                                </h3>
                                {!editingInternal ? (
                                    <button onClick={() => setEditingInternal(true)} className="text-slate-500 hover:text-white transition-colors">
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
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Plánovaný náklad</span>
                                        <span className="font-bold text-white">{plannedCost > 0 ? formatMoneyFull(plannedCost) : 'Nezadáno'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Zasmluvněno</span>
                                        <span className="font-bold text-white">{formatMoneyFull(totalContractedCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 mt-2">
                                        <span className="text-slate-400 text-sm font-bold uppercase">AKTUÁLNÍ REZERVA</span>
                                        <span className={`text-lg font-bold ${plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Plánovaný náklad (Cíl)</label>
                                        <input
                                            type="number"
                                            value={internalForm.plannedCost}
                                            onChange={e => setInternalForm({ ...internalForm, plannedCost: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white font-semibold text-right focus:border-emerald-500/50 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Contract Parameters */}
                    <div className="flex flex-col">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-400">gavel</span>
                                    Parametry smlouvy
                                </h3>
                                {contract && !editingContract ? (
                                    <button onClick={() => setEditingContract(true)} className="text-slate-500 hover:text-white transition-colors">
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
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Splatnost</span>
                                        <span className="font-bold text-white">{contract.maturity} dní</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Záruka</span>
                                        <span className="font-bold text-white">{contract.warranty} měsíců</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Pozastávka</span>
                                        <span className="font-bold text-white">{contract.retention}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Zařízení staveniště</span>
                                        <span className="font-bold text-white">{contract.siteFacilities} %</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                        <span className="text-slate-400 text-sm font-medium">Podíl na pojištění</span>
                                        <span className="font-bold text-white">{contract.insurance} %</span>
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
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Záruka (měsíců)</label>
                                        <input
                                            type="number"
                                            value={contractForm.warranty}
                                            onChange={e => setContractForm({ ...contractForm, warranty: parseInt(e.target.value) || 0 })}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pozastávka</label>
                                        <input
                                            type="text"
                                            value={contractForm.retention}
                                            onChange={e => setContractForm({ ...contractForm, retention: e.target.value })}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Zař. staveniště (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.siteFacilities}
                                            onChange={e => setContractForm({ ...contractForm, siteFacilities: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pojištění (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.insurance}
                                            onChange={e => setContractForm({ ...contractForm, insurance: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
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
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl mt-6">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400">table_chart</span>
                                Přehled Poptávek
                            </h3>
                            {/* Filter Buttons */}
                            <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800/50">
                                <button
                                    onClick={() => setDemandFilter('all')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'all'
                                        ? 'bg-slate-700 text-white shadow'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Všechny ({allCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('open')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'open'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Poptávané ({openCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('closed')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'closed'
                                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Ukončené ({closedCount})
                                </button>
                                <button
                                    onClick={() => setDemandFilter('sod')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'sod'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Zasmluvněné ({sodCount})
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[10px] uppercase text-slate-500 bg-slate-950/30 font-semibold tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 text-center w-24">Stav</th>
                                        <th className="py-3 px-4">Poptávka</th>
                                        <th className="py-3 px-4 text-right">SOD</th>
                                        <th className="py-3 px-4 text-right">Plán</th>
                                        <th className="py-3 px-4 text-right">Cena VŘ</th>
                                        <th className="py-3 px-4 text-right">SOD-VŘ</th>
                                        <th className="py-3 px-4 text-right">PN-VŘ</th>
                                        <th className="py-3 px-4 text-center">Nabídky</th>
                                        <th className="py-3 px-4 text-center">Smlouvy</th>
                                        <th className="py-3 px-4">Vítěz</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {[...filteredCategories].sort((a, b) => a.title.localeCompare(b.title, 'cs')).map(cat => {
                                        const catBids = project.bids?.[cat.id] || [];
                                        const winningBids = catBids.filter(b => b.status === 'sod');
                                        const contractedBids = winningBids.filter(b => b.contracted);
                                        const bidsWithPrice = catBids.filter(b => b.price && b.price !== '?' && b.price !== '-');
                                        const subPrice = winningBids.reduce((sum, bid) => sum + parseMoney(bid.price || '0'), 0);
                                        const diffSod = cat.sodBudget - subPrice;
                                        const diffPlan = cat.planBudget - subPrice;
                                        const hasWinner = winningBids.length > 0;
                                        const winnersNames = winningBids.map(w => w.companyName).join(', ');

                                        // Status badge config
                                        const statusConfig: Record<string, { label: string; color: string }> = {
                                            'open': { label: 'PROBÍHÁ', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
                                            'negotiating': { label: 'JEDNÁNÍ', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
                                            'closed': { label: 'UKONČENO', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
                                            'sod': { label: 'ZASMLUVNĚNO', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }
                                        };
                                        const status = statusConfig[cat.status] || statusConfig['open'];

                                        return (
                                            <tr 
                                                key={cat.id} 
                                                className={`hover:bg-slate-800/30 transition-colors ${onNavigateToPipeline ? 'cursor-pointer' : ''}`}
                                                onClick={() => onNavigateToPipeline?.(cat.id)}
                                            >
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-white">{cat.title}</div>
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-300 font-mono">
                                                    {cat.sodBudget ? formatMoney(cat.sodBudget) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-400 font-mono">
                                                    {cat.planBudget ? formatMoney(cat.planBudget) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono text-white font-medium">
                                                    {hasWinner ? formatMoney(subPrice) : '-'}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-mono font-bold ${hasWinner ? (diffSod >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-slate-600'}`}>
                                                    {hasWinner ? `${diffSod >= 0 ? '+' : ''}${formatMoney(diffSod)}` : '-'}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-mono font-bold ${hasWinner ? (diffPlan >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-slate-600'}`}>
                                                    {hasWinner ? `${diffPlan >= 0 ? '+' : ''}${formatMoney(diffPlan)}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-slate-400 font-medium">{bidsWithPrice.length}</span>
                                                    <span className="text-slate-600"> / {catBids.length}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {hasWinner ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${contractedBids.length === winningBids.length ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'}`}>
                                                                <span className="material-symbols-outlined text-[10px]">handshake</span>
                                                                <span className="text-[10px] font-bold">{contractedBids.length}/{winningBids.length}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-700">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                                                    {winnersNames || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-950/50 border-t border-slate-700 font-bold text-white">
                                        <td colSpan={2} className="py-3 px-4 text-right text-[10px] uppercase text-slate-500">Celkem</td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {formatMoney(project.categories.reduce((acc, c) => acc + (c.sodBudget || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {formatMoney(project.categories.reduce((acc, c) => acc + (c.planBudget || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {formatMoney(project.categories.reduce((sum, cat) => {
                                                const catBids = project.bids?.[cat.id] || [];
                                                const winningBids = catBids.filter(b => b.status === 'sod');
                                                return sum + winningBids.reduce((s, b) => s + parseMoney(b.price || '0'), 0);
                                            }, 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {/* SOD - VR */}
                                            {(() => {
                                                const total = project.categories.reduce((sum, cat) => {
                                                    const catBids = project.bids?.[cat.id] || [];
                                                    const winningBids = catBids.filter(b => b.status === 'sod');
                                                    if (winningBids.length === 0) return sum + 0;
                                                    const subPrice = winningBids.reduce((s, b) => s + parseMoney(b.price || '0'), 0);
                                                    return sum + (cat.sodBudget - subPrice);
                                                }, 0);
                                                return <span className={total >= 0 ? 'text-emerald-500' : 'text-red-500'}>{total >= 0 ? '+' : ''}{formatMoney(total)}</span>;
                                            })()}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {/* PLAN - VR */}
                                            {(() => {
                                                const total = project.categories.reduce((sum, cat) => {
                                                    const catBids = project.bids?.[cat.id] || [];
                                                    const winningBids = catBids.filter(b => b.status === 'sod');
                                                    if (winningBids.length === 0) return sum + 0;
                                                    const subPrice = winningBids.reduce((s, b) => s + parseMoney(b.price || '0'), 0);
                                                    return sum + (cat.planBudget - subPrice);
                                                }, 0);
                                                return <span className={total >= 0 ? 'text-emerald-500' : 'text-red-500'}>{total >= 0 ? '+' : ''}{formatMoney(total)}</span>;
                                            })()}
                                        </td>

                                        <td colSpan={3} className="py-3 px-4"></td>
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
