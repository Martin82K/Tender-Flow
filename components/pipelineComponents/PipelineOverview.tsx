/**
 * PipelineOverview Component
 * Dashboard view showing category cards in grid or table format.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React from 'react';
import { DemandCategory, Bid } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { CategoryCard } from './CategoryCard';

type DemandFilter = 'all' | 'open' | 'closed' | 'sod';
type ViewMode = 'grid' | 'table';

interface PipelineOverviewProps {
    categories: DemandCategory[];
    bids: Record<string, Bid[]>;
    searchQuery: string;
    demandFilter: DemandFilter;
    viewMode: ViewMode;
    onFilterChange: (filter: DemandFilter) => void;
    onViewModeChange: (mode: ViewMode) => void;
    onCategoryClick: (category: DemandCategory) => void;
    onAddClick: () => void;
    onEditCategory: (category: DemandCategory) => void;
    onDeleteCategory: (categoryId: string) => void;
    onToggleCategoryComplete: (category: DemandCategory) => void;
}

export const PipelineOverview: React.FC<PipelineOverviewProps> = ({
    categories,
    bids,
    searchQuery,
    demandFilter,
    viewMode,
    onFilterChange,
    onViewModeChange,
    onCategoryClick,
    onAddClick,
    onEditCategory,
    onDeleteCategory,
    onToggleCategoryComplete,
}) => {
    // Filter counts
    const allCount = categories.length;
    const openCount = categories.filter(c => c.status === 'open' || c.status === 'negotiating').length;
    const closedCount = categories.filter(c => c.status === 'closed').length;
    const sodCount = categories.filter(c => {
        if (c.status === 'sod') return true;
        if (c.status === 'closed') {
            const sodBids = (bids[c.id] || []).filter(b => b.status === 'sod');
            return sodBids.length > 0 && sodBids.every(b => b.contracted);
        }
        return false;
    }).length;

    // Filtered categories
    const filteredCategories = [...categories]
        .sort((a, b) => a.title.localeCompare(b.title, 'cs'))
        .filter((cat) => {
            // Status filter
            if (demandFilter === 'all') {
                // continue
            } else if (demandFilter === 'open') {
                if (cat.status !== 'open' && cat.status !== 'negotiating') return false;
            } else if (demandFilter === 'closed') {
                if (cat.status !== 'closed') return false;
            } else if (demandFilter === 'sod') {
                if (cat.status === 'sod') {
                    // continue
                } else if (cat.status === 'closed') {
                    const catBids = bids[cat.id] || [];
                    const sodBids = catBids.filter((b) => b.status === 'sod');
                    const contractedCount = sodBids.filter((b) => b.contracted).length;
                    if (sodBids.length === 0 || sodBids.length !== contractedCount) return false;
                } else {
                    return false;
                }
            }

            // Search filter
            if (searchQuery && searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const catBids = bids[cat.id] || [];
                const companyNames = catBids.map((b) => b.companyName).join(' ').toLowerCase();
                const matches =
                    cat.title.toLowerCase().includes(query) ||
                    cat.description?.toLowerCase().includes(query) ||
                    companyNames.includes(query);
                if (!matches) return false;
            }

            return true;
        });

    // Category statistics helper
    const getCategoryStats = (categoryId: string) => {
        const categoryBids = bids[categoryId] || [];
        const bidCount = categoryBids.length;
        const priceOfferCount = categoryBids.filter((b) => b.price && b.price !== '?' && b.price.trim() !== '').length;
        const sodBids = categoryBids.filter((b) => b.status === 'sod');
        const sodBidsCount = sodBids.length;
        const contractedCount = sodBids.filter((b) => b.contracted).length;
        const winningPrice = sodBids.reduce((sum, bid) => {
            const numericPrice = typeof bid.price === 'string' ? parseFloat(bid.price.replace(/[^\d]/g, '')) : 0;
            return sum + (isNaN(numericPrice) ? 0 : numericPrice);
        }, 0);
        return { bidCount, priceOfferCount, sodBidsCount, contractedCount, winningPrice: winningPrice > 0 ? winningPrice : undefined };
    };

    const statusLabels: Record<string, string> = {
        open: 'Poptávání',
        negotiating: 'Vyjednávání',
        closed: 'Uzavřeno',
        sod: 'V realizaci',
    };

    const statusClass: Record<string, string> = {
        open: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        negotiating: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
        closed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        sod: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    };

    const getNormalizedStatus = (raw: DemandCategory['status']) =>
        raw === 'sod' ? 'sod' : raw === 'closed' ? 'closed' : raw === 'negotiating' ? 'negotiating' : 'open';

    return (
        <div className="p-6 lg:p-10 overflow-y-auto">
            {/* Filter Buttons and Add Button */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'all'
                            ? 'bg-primary text-white shadow'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                            }`}
                    >
                        Všechny ({allCount})
                    </button>
                    <button
                        onClick={() => onFilterChange('open')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'open'
                            ? 'bg-amber-500 dark:bg-amber-500/20 text-white dark:text-amber-300 border border-amber-500 dark:border-amber-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                            }`}
                    >
                        Poptávané ({openCount})
                    </button>
                    <button
                        onClick={() => onFilterChange('closed')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'closed'
                            ? 'bg-teal-500 dark:bg-teal-500/20 text-white dark:text-teal-300 border border-teal-500 dark:border-teal-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                            }`}
                    >
                        Ukončené ({closedCount})
                    </button>
                    <button
                        onClick={() => onFilterChange('sod')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'sod'
                            ? 'bg-emerald-500 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border border-emerald-500 dark:border-emerald-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                            }`}
                    >
                        Zasmluvněné ({sodCount})
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('grid')}
                            className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'grid'
                                ? 'bg-primary text-white shadow'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                                }`}
                            title="Zobrazení: Karty (Grid)"
                            aria-label="Zobrazení: Karty (Grid)"
                        >
                            <span className="material-symbols-outlined text-[18px] leading-none">grid_view</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewModeChange('table')}
                            className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'table'
                                ? 'bg-primary text-white shadow'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                                }`}
                            title="Zobrazení: Tabulka"
                            aria-label="Zobrazení: Tabulka"
                        >
                            <span className="material-symbols-outlined text-[18px] leading-none">table_rows</span>
                        </button>
                    </div>

                    <button
                        onClick={onAddClick}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            add_home_work
                        </span>
                        <span className="hidden sm:inline">Nová Poptávka</span>
                    </button>
                </div>
            </div>

            {/* Content: Table or Grid */}
            {viewMode === 'table' ? (
                <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-sm">
                            <thead className="bg-slate-100 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-700/40">
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <th className="px-4 py-3">Stav</th>
                                    <th className="px-4 py-3">Poptávka</th>
                                    <th className="px-4 py-3">Termín</th>
                                    <th className="px-4 py-3">Realizace</th>
                                    <th className="px-4 py-3 text-right">Cena</th>
                                    <th className="px-4 py-3 text-right">Poptáno</th>
                                    <th className="px-4 py-3 text-right">CN</th>
                                    <th className="px-4 py-3 text-right">Smlouvy</th>
                                    <th className="px-4 py-3 text-right">Akce</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                                {filteredCategories.map((category) => {
                                    const stats = getCategoryStats(category.id);
                                    const normalizedStatus = getNormalizedStatus(category.status);
                                    const deadline = category.deadline ? new Date(category.deadline).toLocaleDateString('cs-CZ') : '—';
                                    const realization =
                                        category.realizationStart || category.realizationEnd
                                            ? `${category.realizationStart ? new Date(category.realizationStart).toLocaleDateString('cs-CZ') : '?'} – ${category.realizationEnd ? new Date(category.realizationEnd).toLocaleDateString('cs-CZ') : '?'}`
                                            : '—';
                                    const priceValue = stats.winningPrice ?? category.sodBudget;
                                    const price = formatMoney(priceValue);
                                    return (
                                        <tr
                                            key={category.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-950/30 cursor-pointer"
                                            onClick={() => onCategoryClick(category)}
                                        >
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${statusClass[normalizedStatus]}`}>
                                                    {statusLabels[normalizedStatus]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900 dark:text-white">{category.title}</div>
                                                {category.description && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{category.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{deadline}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{realization}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{price}</td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{stats.bidCount}</td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{stats.priceOfferCount}</td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                                                {stats.sodBidsCount > 0 ? `${stats.contractedCount}/${stats.sodBidsCount}` : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onToggleCategoryComplete(category);
                                                        }}
                                                        className={`p-2 rounded-lg transition-colors ${category.status === 'closed'
                                                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-slate-200/70 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                            }`}
                                                        title={category.status === 'closed' ? 'Označit jako otevřenou' : 'Označit jako ukončenou'}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            {category.status === 'closed' ? 'check_circle' : 'task_alt'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditCategory(category);
                                                        }}
                                                        className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                        title="Upravit"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteCategory(category.id);
                                                        }}
                                                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                                        title="Smazat"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCategories.map((category) => {
                        const stats = getCategoryStats(category.id);
                        const categoryWithPrice = { ...category, winningPrice: stats.winningPrice };
                        return (
                            <CategoryCard
                                key={category.id}
                                category={categoryWithPrice}
                                bidCount={stats.bidCount}
                                priceOfferCount={stats.priceOfferCount}
                                contractedCount={stats.contractedCount}
                                sodBidsCount={stats.sodBidsCount}
                                onClick={() => onCategoryClick(category)}
                                onEdit={onEditCategory}
                                onDelete={onDeleteCategory}
                                onToggleComplete={onToggleCategoryComplete}
                            />
                        );
                    })}

                    {/* Add New Placeholder */}
                    <button
                        onClick={onAddClick}
                        className="flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/60 border-2 border-dashed border-primary dark:border-slate-700/40 rounded-2xl p-5 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-900/70 dark:hover:border-emerald-500/30 transition-all min-h-[200px] group"
                    >
                        <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/10 dark:group-hover:bg-emerald-500/20 transition-all">
                            <span className="material-symbols-outlined text-slate-400 dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400">
                                add
                            </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            Vytvořit novou sekci
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Např. Klempířské práce
                        </p>
                    </button>
                </div>
            )}
        </div>
    );
};
