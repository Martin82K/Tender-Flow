import React from 'react';
import { ProjectDetails, DemandCategory } from '../../types';

interface PipelineToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
    demandFilter: 'all' | 'open' | 'closed' | 'sod';
    onDemandFilterChange: (filter: 'all' | 'open' | 'closed' | 'sod') => void;
    activeCategory: DemandCategory | null;
    projectDetails: ProjectDetails;
    onAddCategoryClick: () => void;
    onEditCategoryClick: (category: DemandCategory) => void;
    onToggleCategoryComplete: (category: DemandCategory) => void;
    onDeleteCategory: (categoryId: string) => void;
    onExportXLSX: () => void;
    onExportPDF: () => void;
}

export const PipelineToolbar: React.FC<PipelineToolbarProps> = ({
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
    demandFilter,
    onDemandFilterChange,
    activeCategory,
    projectDetails,
    onAddCategoryClick,
    onEditCategoryClick,
    onToggleCategoryComplete,
    onDeleteCategory,
    onExportXLSX,
    onExportPDF
}) => {
    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Hledat v poptávkách..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                    />
                </div>

                {/* Filters & View Mode */}
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="Zobrazit jako nástěnku"
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button
                            onClick={() => onViewModeChange('table')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="Zobrazit jako tabulku"
                        >
                            <span className="material-symbols-outlined text-[20px]">table_rows</span>
                        </button>
                    </div>

                    <select
                        value={demandFilter}
                        onChange={(e) => onDemandFilterChange(e.target.value as any)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none shadow-sm cursor-pointer"
                    >
                        <option value="all">Všechny poptávky</option>
                        <option value="open">Otevřené</option>
                        <option value="closed">Uzavřené</option>
                        <option value="sod">Podepsané SOD</option>
                    </select>
                </div>
            </div>

            {/* Category Controls (only visible if a category is selected or usually in header, but for now putting here or assuming parent passes correct context) */}
            {/* Wait, the design usually has categories on the left or top. 
                In the current app, it seems there's a category selection process. 
                Let's stick to the props provided.
            */}
        </div>
    );
};
