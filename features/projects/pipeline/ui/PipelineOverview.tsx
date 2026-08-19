/**
 * PipelineOverview Component
 * Dashboard view showing category cards in grid or table format.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@appica/ui-react';
import { BuildingPlus } from '@appica/icons-react';
import type { Bid, DemandCategory } from '@/types';
import { parseFormattedNumber } from '@shared/formatting/decimalFormatters';
import { formatMoney } from '@shared/formatting/numberFormatters';
import {
    exportTenderOverviewToPdf,
    exportTenderOverviewToXlsx,
    getTenderBidStatusLabel,
    sortTenderBidsByStatus,
    type TenderOverviewExportMeta,
} from '@features/projects/api/pipelineOverviewExportApi';
import {
    DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS,
    MAX_PIPELINE_TABLE_COLUMN_WIDTHS,
    MIN_PIPELINE_TABLE_COLUMN_WIDTHS,
    PIPELINE_TABLE_COLUMN_IDS,
    defaultPipelineTablePreferences,
    getPipelineTableStorageKey,
    parsePipelineTablePreferences,
    resizePipelineTableColumn,
    type PipelineTablePreferences,
    type ResizablePipelineTableColumnId,
} from '@features/projects/model/pipelineTablePreferences';
import { CategoryCard } from './CategoryCard';

const ROW_CLICK_DELAY_MS = 220;

const readTablePreferences = (userId: string | null): PipelineTablePreferences => {
    if (typeof window === 'undefined' || !userId) return defaultPipelineTablePreferences();
    try {
        return parsePipelineTablePreferences(
            window.localStorage.getItem(getPipelineTableStorageKey(userId)),
        );
    } catch {
        return defaultPipelineTablePreferences();
    }
};

type DemandFilter = 'all' | 'open' | 'closed' | 'sod';
type ViewMode = 'grid' | 'table';

interface RowContextMenuState {
    category: DemandCategory;
    position: { x: number; y: number };
}

export interface PipelineOverviewProps {
    currentUserId: string | null;
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
    exportMeta: TenderOverviewExportMeta;
    onExportError: (message: string) => void;
}

export const PipelineOverview: React.FC<PipelineOverviewProps> = ({
    currentUserId,
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
    exportMeta,
    onExportError,
}) => {
    const rowClickTimeoutRef = useRef<number | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState | null>(null);
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());
    const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null);
    const [tablePreferences, setTablePreferences] = useState<{
        userId: string | null;
        value: PipelineTablePreferences;
    }>(() => ({
        userId: currentUserId,
        value: readTablePreferences(currentUserId),
    }));
    const resizeRef = useRef<{
        column: ResizablePipelineTableColumnId;
        startX: number;
        startWidth: number;
    } | null>(null);

    const stopResizing = () => {
        resizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    const updateColumnWidth = (column: ResizablePipelineTableColumnId, width: number) => {
        setTablePreferences((current) => ({
            userId: currentUserId,
            value: {
                version: 1,
                widths: {
                    ...(current.userId === currentUserId
                        ? current.value.widths
                        : defaultPipelineTablePreferences().widths),
                    [column]: resizePipelineTableColumn(column, width),
                },
            },
        }));
    };

    useEffect(() => {
        setTablePreferences({ userId: currentUserId, value: readTablePreferences(currentUserId) });
    }, [currentUserId]);

    useEffect(() => {
        if (
            typeof window === 'undefined'
            || !currentUserId
            || tablePreferences.userId !== currentUserId
        ) return;
        try {
            window.localStorage.setItem(
                getPipelineTableStorageKey(currentUserId),
                JSON.stringify(tablePreferences.value),
            );
        } catch {
            // A blocked or full local storage must not make the table unusable.
        }
    }, [currentUserId, tablePreferences]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const resize = resizeRef.current;
            if (!resize) return;
            updateColumnWidth(
                resize.column,
                resize.startWidth + event.clientX - resize.startX,
            );
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopResizing);
        window.addEventListener('pointercancel', stopResizing);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopResizing);
            window.removeEventListener('pointercancel', stopResizing);
            stopResizing();
        };
    }, [currentUserId]);

    useEffect(() => {
        return () => {
            if (rowClickTimeoutRef.current !== null) {
                window.clearTimeout(rowClickTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!rowContextMenu) return;

        const handlePointer = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setRowContextMenu(null);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setRowContextMenu(null);
        };
        const handleScroll = () => setRowContextMenu(null);
        const focusFrame = window.requestAnimationFrame(() => {
            contextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        });

        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [rowContextMenu]);

    const openRowContextMenu = (
        event: React.MouseEvent | React.KeyboardEvent,
        category: DemandCategory,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        const position = 'clientX' in event
            ? { x: event.clientX, y: event.clientY }
            : {
                x: event.currentTarget.getBoundingClientRect().right - 180,
                y: event.currentTarget.getBoundingClientRect().bottom + 4,
            };
        setRowContextMenu({ category, position });
    };

    const handleRowClick = (category: DemandCategory) => {
        if (rowClickTimeoutRef.current !== null) {
            window.clearTimeout(rowClickTimeoutRef.current);
        }

        rowClickTimeoutRef.current = window.setTimeout(() => {
            rowClickTimeoutRef.current = null;
            onCategoryClick(category);
        }, ROW_CLICK_DELAY_MS);
    };

    const handleRowDoubleClick = (category: DemandCategory) => {
        if (rowClickTimeoutRef.current !== null) {
            window.clearTimeout(rowClickTimeoutRef.current);
            rowClickTimeoutRef.current = null;
        }

        onEditCategory(category);
    };

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
            const numericPrice = typeof bid.price === 'string' ? parseFormattedNumber(bid.price) : 0;
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

    const bidStatusTextClass: Record<string, string> = {
        'Poptán': 'text-sky-700 dark:text-sky-300',
        'Nedodal cenu': 'text-amber-700 dark:text-amber-300',
        'Dodal cenu': 'text-emerald-700 dark:text-emerald-300',
        'Užší výběr': 'text-violet-700 dark:text-violet-300',
        'Jednání o SOD': 'text-fuchsia-700 dark:text-fuchsia-300',
        'Zasmluvněn': 'text-emerald-700 dark:text-emerald-300',
        'Zamítnut / odstoupil': 'text-red-700 dark:text-red-300',
    };

    const bidStatusRowClass: Record<string, string> = {
        'Poptán': 'bg-sky-50/60 hover:bg-sky-100/70 dark:bg-sky-950/25 dark:hover:bg-sky-900/35',
        'Nedodal cenu': 'bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/25 dark:hover:bg-amber-900/35',
        'Dodal cenu': 'bg-emerald-50/55 hover:bg-emerald-100/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-900/35',
        'Užší výběr': 'bg-violet-50/60 hover:bg-violet-100/70 dark:bg-violet-950/25 dark:hover:bg-violet-900/35',
        'Jednání o SOD': 'bg-fuchsia-50/60 hover:bg-fuchsia-100/70 dark:bg-fuchsia-950/25 dark:hover:bg-fuchsia-900/35',
        'Zasmluvněn': 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/35 dark:hover:bg-emerald-900/45',
        'Zamítnut / odstoupil': 'bg-red-50/55 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-900/35',
    };

    const bidStatusBorderClass: Record<string, string> = {
        'Poptán': 'border-l-sky-500',
        'Nedodal cenu': 'border-l-amber-500',
        'Dodal cenu': 'border-l-emerald-500',
        'Užší výběr': 'border-l-violet-500',
        'Jednání o SOD': 'border-l-fuchsia-500',
        'Zasmluvněn': 'border-l-emerald-500',
        'Zamítnut / odstoupil': 'border-l-red-500',
    };

    const toggleCategoryExpansion = (categoryId: string) => {
        setExpandedCategoryIds((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const columnWidths = {
        ...DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS,
        ...tablePreferences.value.widths,
    };
    const tableWidth = PIPELINE_TABLE_COLUMN_IDS.reduce(
        (sum, column) => sum + columnWidths[column],
        0,
    );

    const runExport = async (format: 'xlsx' | 'pdf') => {
        setExportingFormat(format);
        try {
            if (format === 'xlsx') {
                await exportTenderOverviewToXlsx(filteredCategories, bids, exportMeta);
            } else {
                await exportTenderOverviewToPdf(filteredCategories, bids, exportMeta);
            }
        } catch (reason) {
            onExportError(
                reason instanceof Error
                    ? reason.message
                    : `Export do ${format.toUpperCase()} se nepodařilo vytvořit.`,
            );
        } finally {
            setExportingFormat(null);
        }
    };

    const renderResizeHandle = (
        column: ResizablePipelineTableColumnId,
        label: string,
    ) => (
        <span
            role="separator"
            tabIndex={0}
            aria-label={`Změnit šířku sloupce ${label}`}
            aria-orientation="vertical"
            aria-valuemin={MIN_PIPELINE_TABLE_COLUMN_WIDTHS[column]}
            aria-valuemax={MAX_PIPELINE_TABLE_COLUMN_WIDTHS[column]}
            aria-valuenow={columnWidths[column]}
            aria-valuetext={`${columnWidths[column]} pixelů`}
            title="Tažením nebo šipkami změnit šířku sloupce"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resizeRef.current = {
                    column,
                    startX: event.clientX,
                    startWidth: columnWidths[column],
                };
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            }}
            onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                event.stopPropagation();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                updateColumnWidth(column, columnWidths[column] + direction * (event.shiftKey ? 40 : 10));
            }}
            className="absolute right-0 top-0 z-10 h-full w-3 translate-x-1/2 cursor-col-resize touch-none border-r border-transparent outline-none hover:border-primary focus-visible:border-primary focus-visible:bg-primary/10"
        />
    );

    return (
        <div className="tf-pipeline-overview overflow-y-auto p-4 md:p-6 lg:p-8">
            {/* Filter Buttons and Add Button */}
            <div
                data-pipeline-toolbar-layer
                className="relative z-20 mb-4 flex flex-wrap items-center justify-between gap-3"
            >
                <div data-help-id="pipeline-filters" className="tf-demand-filterbar min-w-0">
                    <button
                        type="button"
                        onClick={() => onFilterChange('all')}
                        aria-pressed={demandFilter === 'all'}
                        data-active={demandFilter === 'all' ? 'true' : 'false'}
                        className="tf-demand-filter-button flex-none"
                    >
                        Všechny ({allCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => onFilterChange('open')}
                        aria-pressed={demandFilter === 'open'}
                        data-active={demandFilter === 'open' ? 'true' : 'false'}
                        className="tf-demand-filter-button flex-none"
                    >
                        Poptávané ({openCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => onFilterChange('closed')}
                        aria-pressed={demandFilter === 'closed'}
                        data-active={demandFilter === 'closed' ? 'true' : 'false'}
                        className="tf-demand-filter-button flex-none"
                    >
                        Ukončené ({closedCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => onFilterChange('sod')}
                        aria-pressed={demandFilter === 'sod'}
                        data-active={demandFilter === 'sod' ? 'true' : 'false'}
                        className="tf-demand-filter-button flex-none"
                    >
                        Zasmluvněné ({sodCount})
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="Exportovat přehled VŘ do XLSX"
                            title="Exportovat aktuálně filtrovaná VŘ do Excelu"
                            disabled={exportingFormat !== null}
                            onClick={() => void runExport('xlsx')}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-wait disabled:opacity-60 dark:text-emerald-300"
                        >
                            <span className="material-symbols-outlined text-[17px]" aria-hidden>table_view</span>
                            <span className="hidden lg:inline">{exportingFormat === 'xlsx' ? 'Exportuji…' : 'XLSX'}</span>
                        </button>
                        <button
                            type="button"
                            aria-label="Exportovat přehled VŘ do PDF"
                            title="Exportovat aktuálně filtrovaná VŘ do PDF"
                            disabled={exportingFormat !== null}
                            onClick={() => void runExport('pdf')}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-wait disabled:opacity-60 dark:text-red-300"
                        >
                            <span className="material-symbols-outlined text-[17px]" aria-hidden>picture_as_pdf</span>
                            <span className="hidden lg:inline">{exportingFormat === 'pdf' ? 'Exportuji…' : 'PDF'}</span>
                        </button>
                    </div>
                    <div data-help-id="pipeline-view-toggle" className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-900/60">
                        <div className="group relative">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('grid')}
                            aria-pressed={viewMode === 'grid'}
                            aria-describedby="pipeline-grid-tooltip"
                            className={`flex min-h-9 min-w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'grid'
                                ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                                }`}
                            aria-label="Zobrazení: Karty (Grid)"
                        >
                            <span className="material-symbols-outlined text-[18px] leading-none">grid_view</span>
                        </button>
                        <span id="pipeline-grid-tooltip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-max rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-700">Karty</span>
                        </div>
                        <div className="group relative">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('table')}
                            aria-pressed={viewMode === 'table'}
                            aria-describedby="pipeline-table-tooltip"
                            className={`flex min-h-9 min-w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'table'
                                ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                                }`}
                            aria-label="Zobrazení: Tabulka"
                        >
                            <span className="material-symbols-outlined text-[18px] leading-none">table_rows</span>
                        </button>
                        <span id="pipeline-table-tooltip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-max rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-700">Tabulka</span>
                        </div>
                    </div>

                    <Button
                        data-help-id="pipeline-add-category"
                        onClick={onAddClick}
                        variant="primary"
                        size="md"
                        className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <BuildingPlus aria-hidden="true" size={20} strokeWidth={1.7} />
                        <span className="hidden sm:inline">Nová Poptávka</span>
                    </Button>
                </div>
            </div>

            {/* Content: Table or Grid */}
            {viewMode === 'table' ? (
                <div data-help-id="pipeline-overview-table" className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
                    <div data-pipeline-table-scroll className="overflow-x-auto">
                        <table className="w-full table-fixed text-sm" style={{ minWidth: tableWidth }}>
                            <colgroup>
                                {PIPELINE_TABLE_COLUMN_IDS.map((column) => (
                                    <col key={column} style={{ width: columnWidths[column] }} />
                                ))}
                            </colgroup>
                            <thead className="bg-slate-100 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-700/40">
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <th className="relative px-3 py-3">Stav{renderResizeHandle('status', 'Stav')}</th>
                                    <th className="relative px-3 py-3">Poptávka{renderResizeHandle('demand', 'Poptávka')}</th>
                                    <th className="relative whitespace-nowrap px-3 py-3">Termín{renderResizeHandle('deadline', 'Termín')}</th>
                                    <th className="relative whitespace-nowrap px-3 py-3">Realizace{renderResizeHandle('realization', 'Realizace')}</th>
                                    <th className="relative px-3 py-3 text-right">Cena{renderResizeHandle('price', 'Cena')}</th>
                                    <th className="relative px-3 py-3 text-right">Poptáno{renderResizeHandle('requested', 'Poptáno')}</th>
                                    <th className="relative px-3 py-3 text-right">CN{renderResizeHandle('offers', 'CN')}</th>
                                    <th className="relative px-3 py-3 text-right">Smlouvy{renderResizeHandle('contracts', 'Smlouvy')}</th>
                                    <th className="px-3 py-3 text-right">Akce</th>
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
                                    const categoryBids = bids[category.id] || [];
                                    const sortedCategoryBids = sortTenderBidsByStatus(categoryBids);
                                    const isExpanded = expandedCategoryIds.has(category.id);
                                    return (
                                        <React.Fragment key={category.id}>
                                            <tr
                                                tabIndex={0}
                                                aria-label={`${category.title}. Kliknutím otevřít, dvojklikem upravit, pravým tlačítkem nebo Shift+F10 zobrazit další akce.`}
                                                title="Kliknutím otevřít, dvojklikem upravit, pravým tlačítkem zobrazit další akce"
                                                className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 dark:hover:bg-slate-950/30"
                                                onClick={() => handleRowClick(category)}
                                                onDoubleClick={() => handleRowDoubleClick(category)}
                                                onContextMenu={(event) => openRowContextMenu(event, category)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                                                        openRowContextMenu(event, category);
                                                    }
                                                }}
                                            >
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${statusClass[normalizedStatus]}`}>
                                                        {statusLabels[normalizedStatus]}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-start gap-1.5">
                                                        {categoryBids.length > 0 ? (
                                                            <button
                                                                type="button"
                                                                aria-expanded={isExpanded}
                                                                aria-label={`${isExpanded ? 'Sbalit' : 'Rozbalit'} poptané dodavatele VŘ ${category.title}`}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    toggleCategoryExpansion(category.id);
                                                                }}
                                                                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                            >
                                                                <span
                                                                    aria-hidden="true"
                                                                    className={`material-symbols-outlined text-[16px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                                >
                                                                    chevron_right
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            <span className="block size-5 shrink-0" aria-hidden="true" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-900 dark:text-white">{category.title}</div>
                                                            {category.description ? (
                                                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{category.description}</div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{deadline}</td>
                                                <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{realization}</td>
                                                <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">{price}</td>
                                                <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">{stats.bidCount}</td>
                                                <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">{stats.priceOfferCount}</td>
                                                <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                                                    {stats.sodBidsCount > 0 ? `${stats.contractedCount}/${stats.sodBidsCount}` : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onToggleCategoryComplete(category);
                                                            }}
                                                            className={`flex min-h-9 min-w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${category.status === 'closed'
                                                                ? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                                                                }`}
                                                            title={category.status === 'closed' ? 'Označit jako otevřenou' : 'Označit jako ukončenou'}
                                                            aria-label={category.status === 'closed' ? 'Označit jako otevřenou' : 'Označit jako ukončenou'}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                {category.status === 'closed' ? 'check_circle' : 'task_alt'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded
                                                ? sortedCategoryBids.map((bid) => {
                                                    const statusLabel = getTenderBidStatusLabel(bid);
                                                    const selectedRoundPrice = bid.selectionRound == null
                                                        ? undefined
                                                        : bid.priceHistory?.[bid.selectionRound];
                                                    const rawBidPrice = bid.price && bid.price !== '?' && bid.price !== '-'
                                                        ? bid.price
                                                        : selectedRoundPrice;
                                                    const numericBidPrice = rawBidPrice
                                                        ? parseFormattedNumber(rawBidPrice)
                                                        : Number.NaN;
                                                    const contact = [bid.contactPerson, bid.email, bid.phone]
                                                        .filter(Boolean)
                                                        .join(' · ');
                                                    return (
                                                        <tr
                                                            key={bid.id}
                                                            data-parent-category-id={category.id}
                                                            aria-label={`${bid.companyName}. ${statusLabel}. ${contact}`}
                                                            className={`text-xs transition-colors ${bidStatusRowClass[statusLabel] || bidStatusRowClass['Poptán']}`}
                                                        >
                                                            <td className={`border-l-4 px-3 py-2.5 ${bidStatusBorderClass[statusLabel] || bidStatusBorderClass['Poptán']}`}>
                                                                <span
                                                                    data-bid-status={bid.status}
                                                                    className={`text-[11px] font-bold ${bidStatusTextClass[statusLabel] || bidStatusTextClass['Poptán']}`}
                                                                >
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                                                                <div className="flex items-start gap-1.5 pl-1">
                                                                    <span className="material-symbols-outlined mt-0.5 text-[15px] text-cyan-600 dark:text-cyan-400" aria-hidden>
                                                                        subdirectory_arrow_right
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <div className="font-semibold">{bid.companyName}</div>
                                                                        {bid.notes ? (
                                                                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{bid.notes}</div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                                                                {bid.updateDate ? new Date(bid.updateDate).toLocaleDateString('cs-CZ') : '—'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                                                                <div className="truncate">{contact || '—'}</div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                                                                {Number.isFinite(numericBidPrice) ? formatMoney(numericBidPrice) : '—'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">Ano</td>
                                                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                                                                {Number.isFinite(numericBidPrice) ? 'Ano' : 'Ne'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                                                                {bid.contracted ? 'Ano' : bid.status === 'sod' ? 'Čeká' : '—'}
                                                            </td>
                                                            <td className="px-3 py-2.5" aria-hidden="true" />
                                                        </tr>
                                                    );
                                                })
                                                : null}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div data-help-id="pipeline-category-card" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                onDoubleClick={onEditCategory}
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

            {rowContextMenu && (
                <div
                    ref={contextMenuRef}
                    role="menu"
                    aria-label="Akce výběrového řízení"
                    data-help-id="pipeline-row-context-menu"
                    className="fixed z-[80] w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        left: Math.max(8, Math.min(rowContextMenu.position.x, window.innerWidth - 184)),
                        top: Math.max(8, Math.min(rowContextMenu.position.y, window.innerHeight - 52)),
                    }}
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            onDeleteCategory(rowContextMenu.category.id);
                            setRowContextMenu(null);
                        }}
                        className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/40 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden>delete</span>
                        Smazat
                    </button>
                </div>
            )}
        </div>
    );
};
