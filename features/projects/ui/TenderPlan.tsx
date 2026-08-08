import React from 'react';
import type { DemandCategory } from '@/types';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { AlertModal } from '@/shared/ui/AlertModal';
import {
    buildConflictPromptMessage,
    getTenderPlanStatusBadgeClasses,
} from '@/features/projects/model/tenderPlanModel';
import { useTenderPlanController } from '@/features/projects/model/useTenderPlanController';
import { exportTenderPlanToXLSX, downloadTenderImportTemplate } from '@/features/projects/api/tenderPlanExportApi';

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
        <div
            data-layout-density="compact"
            className="tf-tender-plan-view h-full min-h-screen overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-6 lg:p-8"
        >
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="mb-5 flex items-center gap-3">
                    <div data-help-id="tender-plan-header-icon" className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-xl">event_note</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Plán výběrových řízení</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Plánování a sledování VŘ</p>
                    </div>
                </div>

                <div className="animate-fadeIn">
                    <aside data-help-id="tender-plan-sidebar" className="w-full">
                        <nav aria-label="Akce a filtry plánu VŘ" className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/70">
                            <button
                                data-help-id="tender-plan-add"
                                onClick={() => setIsAdding(true)}
                                className="flex min-h-10 flex-none items-center gap-2 rounded-md bg-primary px-3 py-2 text-left text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden>add</span>
                                Nové VŘ
                            </button>

                            <div className="mx-1 h-6 w-px flex-none bg-slate-200 dark:bg-slate-700" aria-hidden />

                            <button
                                onClick={() => setViewMode('all')}
                                aria-pressed={viewMode === 'all'}
                                className={`flex min-h-10 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'all'
                                    ? "bg-slate-100 text-primary dark:bg-slate-800"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden>list</span>
                                Všechna VŘ
                            </button>

                            <button
                                onClick={() => setViewMode('active')}
                                aria-pressed={viewMode === 'active'}
                                className={`flex min-h-10 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'active'
                                    ? "bg-slate-100 text-primary dark:bg-slate-800"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden>running_with_errors</span>
                                Probíhající
                            </button>

                            <button
                                onClick={() => setViewMode('closed')}
                                aria-pressed={viewMode === 'closed'}
                                className={`flex min-h-10 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'closed'
                                    ? "bg-slate-100 text-primary dark:bg-slate-800"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden>check_circle</span>
                                Ukončená
                            </button>

                            <div className="mx-1 h-6 w-px flex-none bg-slate-200 dark:bg-slate-700" aria-hidden />

                            <button
                                onClick={() => setViewMode('tools')}
                                aria-pressed={viewMode === 'tools'}
                                className={`flex min-h-10 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${viewMode === 'tools'
                                    ? "bg-slate-100 text-primary dark:bg-slate-800"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden>handyman</span>
                                Nástroje a Import
                            </button>
                        </nav>

                        <div data-help-id="tender-plan-tip" className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                            <span className="material-symbols-outlined mt-0.5 text-[16px]" aria-hidden>info</span>
                            <p className="text-xs leading-relaxed">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span>{' '}
                                Plánovaná VŘ můžete jedním kliknutím převést na aktivní Výběrová řízení.
                            </p>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="mt-4 min-w-0">
                        {viewMode === 'tools' ? (
                            <div data-help-id="tender-plan-tools" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-primary">handyman</span>
                                    Nástroje pro správu plánu
                                </h3>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800/30">
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

                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800/30">
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined">sync</span>
                                            Synchronizace
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">Automaticky vytvoří plány pro existující kategorie poptávek, které chybí.</p>
                                        <button
                                            onClick={handleSyncExisting}
                                                className="min-h-10 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                        >
                                            Spustit synchronizaci
                                        </button>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800/30">
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
                            <div data-help-id="tender-plan-table" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                                <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-950/60">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Název VŘ</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Od</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Do</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Poptávka</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stav</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Akce</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center">
                                                    <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block animate-spin">progress_activity</span>
                                                    <p className="text-slate-400 text-sm">Načítání plánů VŘ...</p>
                                                </td>
                                            </tr>
                                        )}
                                        {!isLoading && items.length === 0 && !isAdding && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center">
                                                    <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">calendar_month</span>
                                                    <p className="text-slate-400 text-sm">Zatím nemáte žádná plánovaná VŘ</p>
                                                    <p className="text-slate-500 text-xs mt-1">Klikněte na "Nové VŘ" v levém menu</p>
                                                </td>
                                            </tr>
                                        )}

                                        {/* Add new row - displayed at top */}
                                        {isAdding && (
                                            <tr className="border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-950/30">
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="text"
                                                        value={formName}
                                                        onChange={(e) => setFormName(e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        placeholder="Název VŘ"
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="date"
                                                        value={formDateFrom}
                                                        onChange={(e) => setFormDateFrom(e.target.value)}
                                                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="date"
                                                        value={formDateTo}
                                                        onChange={(e) => setFormDateTo(e.target.value)}
                                                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-center">-</td>
                                                <td className="px-4 py-2.5">-</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            data-help-id="tender-plan-save-row"
                                                            onClick={handleAdd}
                                                            className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                                            aria-label="Uložit nové VŘ"
                                                            title="Uložit"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                        <button
                                                            onClick={resetForm}
                                                            className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                                                            aria-label="Zrušit přidání VŘ"
                                                            title="Zrušit"
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
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    value={formName}
                                                                    onChange={(e) => setFormName(e.target.value)}
                                                                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                    placeholder="Název VŘ"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    type="date"
                                                                    value={formDateFrom}
                                                                    onChange={(e) => setFormDateFrom(e.target.value)}
                                                                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    type="date"
                                                                    value={formDateTo}
                                                                    onChange={(e) => setFormDateTo(e.target.value)}
                                                                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">-</td>
                                                            <td className="px-4 py-2.5">-</td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        data-help-id="tender-plan-save-row"
                                                                        onClick={handleUpdate}
                                                                        className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                                                        aria-label="Uložit změny VŘ"
                                                                        title="Uložit"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">check</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={resetForm}
                                                                        className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                                                                        aria-label="Zrušit úpravu VŘ"
                                                                        title="Zrušit"
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
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                                {item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('cs-CZ') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                                {item.dateTo ? new Date(item.dateTo).toLocaleDateString('cs-CZ') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            {hasCategory ? (
                                                                <span data-help-id="tender-plan-created-badge" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                    Vytvořeno
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    data-help-id="tender-plan-create-demand"
                                                                    onClick={() => handleCreateCategory(item)}
                                                                    className="inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                                                    Vytvořit
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span data-help-id="tender-plan-status-badge" className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${getTenderPlanStatusBadgeClasses(status.color)}`}>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleEdit(item)}
                                                                    className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800 dark:hover:text-white"
                                                                    title="Upravit"
                                                                    aria-label="Upravit VŘ"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                                                    title="Smazat"
                                                                    aria-label="Smazat VŘ"
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
