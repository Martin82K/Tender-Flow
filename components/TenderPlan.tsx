import React from 'react';
import type { DemandCategory } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { AlertModal } from './AlertModal';
import {
    buildConflictPromptMessage,
    getTenderPlanStatusBadgeClasses,
} from '@/features/projects/model/tenderPlanModel';
import { useTenderPlanController } from '@/features/projects/model/useTenderPlanController';
import { exportTenderPlanToXLSX, downloadTenderImportTemplate } from '../services/exportService';

interface TenderPlanProps {
    projectId: string;
    categories: DemandCategory[];
    onCreateCategory: (name: string, dateFrom: string, dateTo: string) => void;
}

export const TenderPlan: React.FC<TenderPlanProps> = ({ projectId, categories, onCreateCategory }) => {
    const {
        items,
        isAdding,
        setIsAdding,
        editingId,
        isLoading,
        fileInputRef,
        formName,
        setFormName,
        formDateFrom,
        setFormDateFrom,
        formDateTo,
        setFormDateTo,
        confirmModal,
        closeConfirmModal,
        alertModal,
        closeAlertModal,
        importConflicts,
        viewMode,
        setViewMode,
        resolveConflict,
        findLinkedCategory,
        getStatus,
        handleAdd,
        handleEdit,
        handleUpdate,
        handleDelete,
        handleCreateCategory,
        resetForm,
        handleSyncExisting,
        handleImportClick,
        handleFileChange,
        visibleItems,
    } = useTenderPlanController({
        projectId,
        categories,
        onCreateCategory,
    });

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8 px-4 md:px-0">
                    <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400 text-2xl">event_note</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plán výběrových řízení</h2>
                        <p className="text-sm text-slate-400">Plánování a sledování VŘ</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">
                    {/* Sidebar Navigation */}
                    <aside data-help-id="tender-plan-sidebar" className="w-full md:w-64 flex-shrink-0">
                        <nav className="flex flex-col gap-2">
                            <button
                                onClick={() => setIsAdding(true)}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-start gap-3 text-left my-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                Nové VŘ
                            </button>

                            <button
                                onClick={() => setViewMode('all')}
                                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${viewMode === 'all'
                                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[20px]">list</span>
                                    Všechna VŘ
                                </div>
                            </button>

                            <button
                                onClick={() => setViewMode('active')}
                                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${viewMode === 'active'
                                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[20px]">running_with_errors</span>
                                    Probíhající
                                </div>
                            </button>

                            <button
                                onClick={() => setViewMode('closed')}
                                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${viewMode === 'closed'
                                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                    Ukončená
                                </div>
                            </button>

                            <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-2 mx-4"></div>

                            <button
                                onClick={() => setViewMode('tools')}
                                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${viewMode === 'tools'
                                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[20px]">handyman</span>
                                    Nástroje a Import
                                </div>
                            </button>
                        </nav>

                        {/* Info tip side */}
                        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mx-2 md:mx-0">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-blue-400 text-[20px]">info</span>
                                <div>
                                    <h4 className="font-semibold text-blue-300 text-sm mb-1">Tip</h4>
                                    <p className="text-xs text-blue-400/80 leading-relaxed">
                                        Plánovaná VŘ můžete jedním kliknutím převést na aktivní Výběrová řízení.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {viewMode === 'tools' ? (
                            <div data-help-id="tender-plan-tools" className="bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-sm p-8">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">handyman</span>
                                    Nástroje pro správu plánu
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors bg-slate-50 dark:bg-slate-800/30">
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined">upload_file</span>
                                            Import z Excelu
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">Nahrajte hromadně plány VŘ z excelovské tabulky.</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => downloadTenderImportTemplate()}
                                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold"
                                            >
                                                Stáhnout šablonu
                                            </button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                accept=".xlsx"
                                                className="hidden"
                                            />
                                            <button
                                                onClick={handleImportClick}
                                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold"
                                            >
                                                Vybrat soubor
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors bg-slate-50 dark:bg-slate-800/30">
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined">sync</span>
                                            Synchronizace
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">Automaticky vytvoří plány pro existující kategorie poptávek, které chybí.</p>
                                        <button
                                            onClick={handleSyncExisting}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            Spustit synchronizaci
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors bg-slate-50 dark:bg-slate-800/30">
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined">file_download</span>
                                            Export
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">Stáhnout aktuální plán VŘ do Excelu pro reporting.</p>
                                        <button
                                            onClick={() => exportTenderPlanToXLSX(items, projectId)}
                                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold"
                                        >
                                            Exportovat data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div data-help-id="tender-plan-table" className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-950/60">
                                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Název VŘ</th>
                                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Od</th>
                                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Do</th>
                                            <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Poptávka</th>
                                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stav</th>
                                            <th className="text-right px-6 py-4 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Akce</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block animate-spin">progress_activity</span>
                                                    <p className="text-slate-400 text-sm">Načítání plánů VŘ...</p>
                                                </td>
                                            </tr>
                                        )}
                                        {!isLoading && items.length === 0 && !isAdding && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">calendar_month</span>
                                                    <p className="text-slate-400 text-sm">Zatím nemáte žádná plánovaná VŘ</p>
                                                    <p className="text-slate-500 text-xs mt-1">Klikněte na "Nové VŘ" v levém menu</p>
                                                </td>
                                            </tr>
                                        )}

                                        {/* Add new row - displayed at top */}
                                        {isAdding && (
                                            <tr className="border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-950/30">
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        value={formName}
                                                        onChange={(e) => setFormName(e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                                        placeholder="Název VŘ"
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="date"
                                                        value={formDateFrom}
                                                        onChange={(e) => setFormDateFrom(e.target.value)}
                                                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="date"
                                                        value={formDateTo}
                                                        onChange={(e) => setFormDateTo(e.target.value)}
                                                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">-</td>
                                                <td className="px-6 py-4">-</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={handleAdd}
                                                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                        <button
                                                            onClick={resetForm}
                                                            className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {visibleItems.map(item => {
                                                const status = getStatus(item);
                                                const hasCategory = !!findLinkedCategory(item);
                                                const isEditing = editingId === item.id;

                                                if (isEditing) {
                                                    return (
                                                        <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-950/30">
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="text"
                                                                    value={formName}
                                                                    onChange={(e) => setFormName(e.target.value)}
                                                                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                                                    placeholder="Název VŘ"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="date"
                                                                    value={formDateFrom}
                                                                    onChange={(e) => setFormDateFrom(e.target.value)}
                                                                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="date"
                                                                    value={formDateTo}
                                                                    onChange={(e) => setFormDateTo(e.target.value)}
                                                                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4 text-center">-</td>
                                                            <td className="px-6 py-4">-</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={handleUpdate}
                                                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">check</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={resetForm}
                                                                        className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                                {item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('cs-CZ') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                                {item.dateTo ? new Date(item.dateTo).toLocaleDateString('cs-CZ') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {hasCategory ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/30">
                                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                    Vytvořeno
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleCreateCategory(item)}
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg border border-blue-500/30 transition-colors"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                                                    Vytvořit
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg border ${getTenderPlanStatusBadgeClasses(status.color)}`}>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleEdit(item)}
                                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                                                    title="Upravit"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
                        )}
                    </main>
                </div>

                {/* Confirmation Modal */}
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={closeConfirmModal}
                    confirmLabel="Smazat"
                    variant="danger"
                />

                {/* Conflict Resolution Modal */}
                <ConfirmationModal
                    isOpen={importConflicts.length > 0}
                    title="Konflikt importu"
                    message={buildConflictPromptMessage(importConflicts[0], importConflicts.length)}
                    onConfirm={() => resolveConflict('overwrite')}
                    onCancel={() => resolveConflict('skip')}
                    confirmLabel="Aktualizovat"
                    cancelLabel="Přeskočit"
                    variant="info"
                />

                <AlertModal
                    isOpen={alertModal.isOpen}
                    onClose={closeAlertModal}
                    title={alertModal.title}
                    message={alertModal.message}
                    variant={alertModal.variant}
                />
            </div>
        </div>
    );
};
