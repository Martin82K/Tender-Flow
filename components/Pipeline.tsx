import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { DemandCategory, Bid, BidStatus } from '../types';
import { PROJECTS_DB, INITIAL_BIDS } from '../data';

// --- Components ---

interface ColumnProps {
    title: string;
    status: BidStatus;
    color: 'slate' | 'blue' | 'amber' | 'green' | 'red';
    children: React.ReactNode;
    count?: number;
    onDrop: (e: React.DragEvent, status: BidStatus) => void;
}

const Column: React.FC<ColumnProps> = ({ title, status, color, children, count, onDrop }) => {
    const [isOver, setIsOver] = useState(false);

    const colorStyles = {
        slate: { 
            wrapper: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-white/5',
            headerBorder: 'border-slate-300 dark:border-slate-700',
            headerBg: 'bg-slate-50/90 dark:bg-slate-900/80'
        },
        blue: { 
            wrapper: 'border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-500/5', 
            headerBorder: 'border-blue-200 dark:border-blue-800',
            headerBg: 'bg-blue-50/90 dark:bg-slate-900/80'
        },
        amber: { 
            wrapper: 'border-amber-100 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-500/5', 
            headerBorder: 'border-amber-200 dark:border-amber-800',
            headerBg: 'bg-amber-50/90 dark:bg-slate-900/80'
        },
        green: { 
            wrapper: 'border-green-100 bg-green-50 dark:border-green-900/30 dark:bg-green-500/5', 
            headerBorder: 'border-green-200 dark:border-green-800',
            headerBg: 'bg-green-50/90 dark:bg-slate-900/80'
        },
        red: { 
            wrapper: 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-500/5', 
            headerBorder: 'border-red-200 dark:border-red-800',
            headerBg: 'bg-red-50/90 dark:bg-slate-900/80'
        }
    };

    const styles = colorStyles[color];

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        setIsOver(false);
        onDrop(e, status);
    };

    return (
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col w-80 flex-shrink-0 rounded-xl h-full max-h-full border transition-colors ${styles.wrapper} ${isOver ? 'ring-2 ring-primary ring-inset bg-opacity-70' : ''}`}
        >
            <div className={`p-4 border-b-2 ${styles.headerBorder} ${styles.headerBg} sticky top-0 rounded-t-xl z-10 backdrop-blur-sm flex justify-between items-center transition-colors`}>
                 <h2 className="text-slate-900 dark:text-slate-100 text-sm font-bold uppercase tracking-wide">{title}</h2>
                 {count !== undefined && <span className="bg-white dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">{count}</span>}
            </div>
            <div className="flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar flex-1">
                {children}
            </div>
        </div>
    );
}

const BidCard: React.FC<{ bid: Bid, onClick?: () => void, onDragStart: (e: React.DragEvent, bidId: string) => void }> = ({ bid, onClick, onDragStart }) => {
    return (
        <div 
            draggable
            onDragStart={(e) => onDragStart(e, bid.id)}
            onClick={onClick} 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group"
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{bid.companyName}</h3>
                {bid.price && bid.price !== '-' && bid.price !== '?' && (
                    <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                        {bid.price}
                    </span>
                )}
            </div>
            
            <div className="flex flex-col gap-1 mb-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {bid.contactPerson}
                </div>
                {bid.notes && (
                    <p className="text-xs text-slate-400 italic mt-1">"{bid.notes}"</p>
                )}
            </div>

            {bid.tags && bid.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                    {bid.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

const CategoryCard: React.FC<{ category: DemandCategory, onClick: () => void }> = ({ category, onClick }) => {
    const statusColors = {
        open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
        negotiating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
        closed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
        sod: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
    };

    const statusLabels = {
        open: 'Poptávání',
        negotiating: 'Vyjednávání',
        closed: 'Uzavřeno',
        sod: 'V Realizaci',
    };

    const status = category.status === 'sod' ? 'sod' : category.status === 'closed' ? 'closed' : category.status === 'negotiating' ? 'negotiating' : 'open';

    return (
        <button onClick={onClick} className="flex flex-col text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all group relative overflow-hidden h-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex justify-between w-full items-start mb-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusColors[status]}`}>
                    {statusLabels[status]}
                </span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{category.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                {category.description}
            </p>

            <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                     <span className="text-xs text-slate-400">Budget</span>
                     <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{category.budget}</span>
                </div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-slate-400">Dodavatelé</span>
                     <div className="flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span className="material-symbols-outlined text-[16px]">groups</span>
                        {category.subcontractorCount}
                     </div>
                </div>
            </div>
        </button>
    );
}


interface PipelineProps {
    projectId: string;
}

export const Pipeline: React.FC<PipelineProps> = ({ projectId }) => {
    const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(null);
    const [bids, setBids] = useState<Record<string, Bid[]>>(INITIAL_BIDS);
    
    // Reset active category when switching projects
    useEffect(() => {
        setActiveCategory(null);
    }, [projectId]);

    const projectData = PROJECTS_DB[projectId] || { title: 'Unknown Project', categories: [] };

    const getBidsForColumn = (categoryId: string, status: BidStatus) => {
        return (bids[categoryId] || []).filter(bid => bid.status === status);
    };

    const handleDragStart = (e: React.DragEvent, bidId: string) => {
        e.dataTransfer.setData('bidId', bidId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetStatus: BidStatus) => {
        e.preventDefault();
        const bidId = e.dataTransfer.getData('bidId');
        
        if (activeCategory && bidId) {
            setBids(prev => {
                const categoryBids = [...(prev[activeCategory.id] || [])];
                const bidIndex = categoryBids.findIndex(b => b.id === bidId);
                
                if (bidIndex > -1 && categoryBids[bidIndex].status !== targetStatus) {
                    categoryBids[bidIndex] = { ...categoryBids[bidIndex], status: targetStatus };
                    return { ...prev, [activeCategory.id]: categoryBids };
                }
                return prev;
            });
        }
    };

    if (activeCategory) {
        // --- DETAIL VIEW (PIPELINE) ---
        return (
            <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
                <Header title={activeCategory.title} subtitle={`${projectData.title} > Průběh výběrového řízení`}>
                    <button 
                        onClick={() => setActiveCategory(null)}
                        className="mr-auto flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="text-sm font-medium">Zpět na přehled</span>
                    </button>
                     <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span>Přidat dodavatele</span>
                    </button>
                </Header>
                
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                    <div className="flex h-full space-x-4 min-w-max">
                        {/* 1. Oslovení (Contacted) */}
                        <Column 
                            title="Oslovení / Odesláno" 
                            status="sent"
                            color="slate" 
                            count={getBidsForColumn(activeCategory.id, 'sent').length}
                            onDrop={handleDrop}
                        >
                             {getBidsForColumn(activeCategory.id, 'sent').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} />
                             ))}
                             {getBidsForColumn(activeCategory.id, 'sent').length === 0 && (
                                 <div className="text-center p-4 text-slate-400 text-sm italic">Žádní dodavatelé v této fázi</div>
                             )}
                        </Column>

                        {/* 2. Cenová nabídka (Offers) */}
                        <Column 
                            title="Cenová nabídka" 
                            status="offer"
                            color="blue" 
                            count={getBidsForColumn(activeCategory.id, 'offer').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'offer').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} />
                             ))}
                        </Column>

                        {/* 3. Užší výběr (Shortlist) */}
                         <Column 
                            title="Užší výběr" 
                            status="shortlist"
                            color="amber" 
                            count={getBidsForColumn(activeCategory.id, 'shortlist').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'shortlist').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} />
                             ))}
                        </Column>

                        {/* 4. Jednání o SOD (Contract Negotiation) */}
                        <Column 
                            title="Jednání o SOD" 
                            status="sod"
                            color="green" 
                            count={getBidsForColumn(activeCategory.id, 'sod').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'sod').map(bid => (
                                 <div key={bid.id} className="relative">
                                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 z-10 shadow-sm pointer-events-none">
                                        <span className="material-symbols-outlined text-[16px] block">trophy</span>
                                    </div>
                                    <BidCard bid={bid} onDragStart={handleDragStart} />
                                 </div>
                             ))}
                        </Column>
                        
                         {/* 5. Zamítnuto (Rejected) */}
                         <Column 
                            title="Zamítnuto / Odstoupili" 
                            status="rejected"
                            color="red"
                            onDrop={handleDrop}
                        >
                              {getBidsForColumn(activeCategory.id, 'rejected').map(bid => (
                                  <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} />
                              ))}
                         </Column>
                    </div>
                </div>
            </div>
        );
    }

    // --- LIST VIEW (OVERVIEW) ---
    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            <Header title={`Stavba: ${projectData.title}`} subtitle="Přehled poptávek a subdodávek">
                 <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
                    <span className="material-symbols-outlined text-[20px]">add_home_work</span>
                    <span className="hidden sm:inline">Nová Poptávka</span>
                </button>
            </Header>

            <div className="p-6 lg:p-10 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {projectData.categories.map((category) => (
                        <CategoryCard 
                            key={category.id} 
                            category={category} 
                            onClick={() => setActiveCategory(category)} 
                        />
                    ))}
                    
                    {/* Add New Placeholder */}
                    <button className="flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[200px] group">
                        <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">add</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-600 dark:text-slate-400">Vytvořit novou sekci</h3>
                        <p className="text-xs text-slate-400 mt-1">Např. Klempířské práce</p>
                    </button>
                </div>
            </div>
        </div>
    );
};