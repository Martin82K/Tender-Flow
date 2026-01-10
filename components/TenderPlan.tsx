import React, { useState, useEffect } from 'react';
import { TenderPlanItem, DemandCategory } from '../types';
import { supabase } from '../services/supabase';
import { ConfirmationModal } from './ConfirmationModal';
import { AlertModal } from './AlertModal';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { exportTenderPlanToXLSX, downloadTenderImportTemplate, importTenderPlanFromXLSX } from '../services/exportService';

interface TenderPlanProps {
    projectId: string;
    categories: DemandCategory[];
    onCreateCategory: (name: string, dateFrom: string, dateTo: string) => void;
}

export const TenderPlan: React.FC<TenderPlanProps> = ({ projectId, categories, onCreateCategory }) => {
    const [items, setItems] = useState<TenderPlanItem[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDateFrom, setFormDateFrom] = useState('');
    const [formDateTo, setFormDateTo] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // Alert Modal State
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'info';
    }>({ isOpen: false, title: '', message: '', variant: 'info' });

    const closeAlertModal = () => setAlertModal(prev => ({ ...prev, isOpen: false }));

    // Import Conflict State
    interface ImportConflict {
        existingItem: TenderPlanItem;
        importItem: { name: string; dateFrom: string; dateTo: string };
        importKey: string;
    }
    const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
    const [importStats, setImportStats] = useState<{ imported: number; updated: number; skipped: number }>({ imported: 0, updated: 0, skipped: 0 });

    const resolveConflict = async (action: 'overwrite' | 'skip') => {
        const conflict = importConflicts[0];
        if (!conflict) return;

        const nextStats = { ...importStats };

        if (action === 'overwrite') {
            const { error } = await supabase
                .from('tender_plans')
                .update({
                    date_from: conflict.importItem.dateFrom || null,
                    date_to: conflict.importItem.dateTo || null
                })
                .eq('id', conflict.existingItem.id);

            if (!error) {
                nextStats.updated++;
                // Update local state
                setItems(prev => prev.map(item =>
                    item.id === conflict.existingItem.id
                        ? { ...item, dateFrom: conflict.importItem.dateFrom, dateTo: conflict.importItem.dateTo }
                        : item
                ));
            } else {
                console.error("Error updating tender plan during conflict resolution:", error);
                nextStats.skipped++;
            }
        } else {
            nextStats.skipped++;
        }

        setImportStats(nextStats);
        const remaining = importConflicts.slice(1);
        setImportConflicts(remaining);

        if (remaining.length === 0) {
            setAlertModal({
                isOpen: true,
                title: 'Import dokončen',
                message: `Nově přidáno: ${nextStats.imported}\nAktualizováno: ${nextStats.updated}\nPřeskočeno: ${nextStats.skipped}`,
                variant: 'success'
            });
            // Optional: trigger full reload here if needed
        }
    };

    // Load from Supabase
    useEffect(() => {
        const loadItems = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('tender_plans')
                    .select('*')
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error('Error loading tender plans:', error);
                    setItems([]);
                } else {
                    // Map DB columns to frontend model
                    const mapped = (data || []).map(row => ({
                        id: row.id,
                        name: row.name,
                        dateFrom: row.date_from || '',
                        dateTo: row.date_to || '',
                        categoryId: row.category_id || undefined
                    }));
                    setItems(mapped);
                }
            } catch (err) {
                console.error('Unexpected error loading tender plans:', err);
                setItems([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadItems();
    }, [projectId]);

    // Find linked category by name
    const findLinkedCategory = (item: TenderPlanItem): DemandCategory | undefined => {
        return categories.find(c => c.title.toLowerCase() === item.name.toLowerCase());
    };

    // Get status based on linked category
    const getStatus = (item: TenderPlanItem): { label: string; color: string } => {
        const category = findLinkedCategory(item);
        if (!category) {
            return { label: 'Čeká na vytvoření', color: 'slate' };
        }

        switch (category.status) {
            case 'open':
                return { label: 'Probíhá', color: 'blue' };
            case 'sod':
                return { label: 'Zasmluvněno', color: 'emerald' };
            case 'closed':
                return { label: 'Ukončeno', color: 'slate' };
            default:
                return { label: 'Aktivní', color: 'amber' };
        }
    };

    const handleAdd = async () => {
        if (!formName.trim()) return;

        const newItem: TenderPlanItem = {
            id: `tp_${Date.now()}`,
            name: formName.trim(),
            dateFrom: formDateFrom,
            dateTo: formDateTo,
        };

        // Optimistic update
        setItems(prev => [...prev, newItem]);
        resetForm();

        // Persist to Supabase
        try {
            const { error } = await supabase.from('tender_plans').insert({
                id: newItem.id,
                project_id: projectId,
                name: newItem.name,
                date_from: newItem.dateFrom || null,
                date_to: newItem.dateTo || null
            });

            if (error) {
                console.error('Error inserting tender plan:', error);
                // Revert on error
                setItems(prev => prev.filter(i => i.id !== newItem.id));
            }
        } catch (err) {
            console.error('Unexpected error inserting tender plan:', err);
            setItems(prev => prev.filter(i => i.id !== newItem.id));
        }
    };

    const handleEdit = (item: TenderPlanItem) => {
        setEditingId(item.id);
        setFormName(item.name);
        setFormDateFrom(item.dateFrom);
        setFormDateTo(item.dateTo);
    };

    const handleUpdate = async () => {
        if (!editingId || !formName.trim()) return;

        const updatedData = {
            name: formName.trim(),
            dateFrom: formDateFrom,
            dateTo: formDateTo
        };

        // Optimistic update
        setItems(prev => prev.map(item =>
            item.id === editingId
                ? { ...item, ...updatedData }
                : item
        ));
        const previousItems = items;
        resetForm();

        // Persist to Supabase
        try {
            const { error } = await supabase
                .from('tender_plans')
                .update({
                    name: updatedData.name,
                    date_from: updatedData.dateFrom || null,
                    date_to: updatedData.dateTo || null
                })
                .eq('id', editingId);

            if (error) {
                console.error('Error updating tender plan:', error);
                setItems(previousItems);
            }
        } catch (err) {
            console.error('Unexpected error updating tender plan:', err);
            setItems(previousItems);
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Smazat plán',
            message: 'Opravdu smazat tento plán? Tato akce je nevratná.',
            onConfirm: () => executeDelete(id)
        });
    };

    const executeDelete = async (id: string) => {
        closeConfirmModal();

        const previousItems = items;
        // Optimistic update
        setItems(prev => prev.filter(item => item.id !== id));

        // Persist to Supabase
        try {
            const { error } = await supabase
                .from('tender_plans')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting tender plan:', error);
                setItems(previousItems);
            }
        } catch (err) {
            console.error('Unexpected error deleting tender plan:', err);
            setItems(previousItems);
        }
    };

    const handleCreateCategory = (item: TenderPlanItem) => {
        onCreateCategory(item.name, item.dateFrom, item.dateTo);
    };

    const resetForm = () => {
        setFormName('');
        setFormDateFrom('');
        setFormDateTo('');
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSyncExisting = async () => {
        setIsLoading(true);
        try {
            // Iterate over current project categories
            let createdCount = 0;
            let linkedCount = 0;

            for (const cat of categories) {
                // Check if exists in current items (client-side check first for speed)
                const existingItem = items.find(i =>
                    i.name.toLowerCase() === cat.title.toLowerCase() ||
                    (i.categoryId && i.categoryId === cat.id)
                );

                if (!existingItem) {
                    // Create new plan item
                    const { error } = await supabase.from('tender_plans').insert({
                        id: `tp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        project_id: projectId,
                        name: cat.title,
                        date_from: cat.realizationStart || null,
                        date_to: cat.realizationEnd || null,
                        category_id: cat.id
                    });
                    if (!error) createdCount++;
                } else if (!existingItem.categoryId) {
                    // Link existing
                    const { error } = await supabase
                        .from('tender_plans')
                        .update({ category_id: cat.id })
                        .eq('id', existingItem.id);
                    if (!error) linkedCount++;
                }
            }

            if (createdCount > 0 || linkedCount > 0) {
                // Reload items
                const { data, error } = await supabase
                    .from('tender_plans')
                    .select('*')
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: true });

                if (!error && data) {
                    const mapped = data.map(row => ({
                        id: row.id,
                        name: row.name,
                        dateFrom: row.date_from || '',
                        dateTo: row.date_to || '',
                        categoryId: row.category_id || undefined
                    }));
                    setItems(mapped);
                    setAlertModal({
                        isOpen: true,
                        title: 'Synchronizace dokončena',
                        message: `Vytvořeno ${createdCount}, Propojeno ${linkedCount} položek.`,
                        variant: 'success'
                    });
                }
            } else {
                setAlertModal({
                    isOpen: true,
                    title: 'Synchronizace',
                    message: 'Vše je již synchronizováno.',
                    variant: 'info'
                });
            }

        } catch (err) {
            console.error("Error during manual sync:", err);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při synchronizaci.',
                variant: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        // Reset stats
        const currentStats = { imported: 0, updated: 0, skipped: 0 };
        setImportStats(currentStats);
        setImportConflicts([]);

        try {
            const parsedItems = await importTenderPlanFromXLSX(file);

            if (parsedItems.length === 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'Chyba importu',
                    message: 'Nepodařilo se načíst žádná data. Zkontrolujte formát souboru.',
                    variant: 'error'
                });
                setIsLoading(false);
                return;
            }

            const normalizeName = (value: string) => value.trim().toLowerCase();

            // Refresh existing items first
            let existingItems = items;
            try {
                const { data, error } = await supabase
                    .from('tender_plans')
                    .select('*')
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: true });
                if (!error && data) {
                    existingItems = data.map(row => ({
                        id: row.id,
                        name: row.name,
                        dateFrom: row.date_from || '',
                        dateTo: row.date_to || '',
                        categoryId: row.category_id || undefined
                    }));
                    setItems(existingItems); // Update local state
                }
            } catch (err) {
                console.warn("Unable to refresh existing tender plans before import:", err);
            }

            const existingByName = new Map<string, TenderPlanItem[]>();
            existingItems.forEach(item => {
                const key = normalizeName(item.name);
                if (!key) return;
                const list = existingByName.get(key) ?? [];
                list.push(item);
                existingByName.set(key, list);
            });

            const seenImportNames = new Set<string>();
            const conflictsFound: ImportConflict[] = [];

            // Process items
            for (const item of parsedItems) {
                if (!item.name) { currentStats.skipped++; continue; }
                const importName = item.name.trim();
                if (!importName) { currentStats.skipped++; continue; }

                const importKey = normalizeName(importName);
                if (seenImportNames.has(importKey)) { currentStats.skipped++; continue; }
                seenImportNames.add(importKey);

                const existingMatch = existingByName.get(importKey)?.[0];
                const nextFrom = (item.dateFrom || '').trim();
                const nextTo = (item.dateTo || '').trim();

                if (existingMatch) {
                    const currentFrom = (existingMatch.dateFrom || '').trim();
                    const currentTo = (existingMatch.dateTo || '').trim();
                    const datesDiffer = currentFrom !== nextFrom || currentTo !== nextTo;

                    if (datesDiffer) {
                        // Conflict detected - add to queue
                        conflictsFound.push({
                            existingItem: existingMatch,
                            importItem: { name: importName, dateFrom: nextFrom, dateTo: nextTo },
                            importKey
                        });
                    } else {
                        currentStats.skipped++; // Exists and same dates
                    }
                } else {
                    // New item - insert immediately
                    const newItemId = `tp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    const { error } = await supabase.from('tender_plans').insert({
                        id: newItemId,
                        project_id: projectId,
                        name: importName,
                        date_from: nextFrom || null,
                        date_to: nextTo || null
                    });

                    if (!error) {
                        currentStats.imported++;
                        // Add to local state immediately so subsequent lookups (if any) or display is correct
                        const newItem = {
                            id: newItemId,
                            name: importName,
                            dateFrom: nextFrom,
                            dateTo: nextTo
                        };
                        setItems(prev => [...prev, newItem]);
                    } else {
                        console.error("Error inserting tender plan during import:", error);
                        currentStats.skipped++;
                    }
                }
            }

            setImportStats(currentStats);
            setImportConflicts(conflictsFound);

            if (conflictsFound.length === 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'Import dokončen',
                    message: `Nově přidáno: ${currentStats.imported}\nAktualizováno: ${currentStats.updated}\nPřeskočeno: ${currentStats.skipped}`,
                    variant: 'success'
                });
            }

        } catch (err) {
            console.error('Error importing file:', err);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při importu souboru.',
                variant: 'error'
            });
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
            <div className="max-w-5xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-400 text-2xl">event_note</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plán výběrových řízení</h2>
                            <p className="text-sm text-slate-400">Plánování a sledování VŘ</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => downloadTenderImportTemplate()}
                            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            title="Stáhnout šablonu pro import poptávek"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            Šablona
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        <button
                            onClick={handleImportClick}
                            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            title="Importovat plán z Excelu"
                        >
                            <span className="material-symbols-outlined text-[18px]">upload_file</span>
                            Import
                        </button>
                        <button
                            onClick={handleSyncExisting}
                            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            title="Synchronizovat s existujícími poptávkami"
                        >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                            Sync
                        </button>
                        <button
                            onClick={() => exportTenderPlanToXLSX(items, projectId)} // Note: projectId needs to be title, let's fix this in component
                            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            title="Exportovat plán do Excelu"
                        >
                            <span className="material-symbols-outlined text-[18px]">file_download</span>
                            Export
                        </button>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Přidat VŘ
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl overflow-hidden">
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
                                        <p className="text-slate-500 text-xs mt-1">Klikněte na "Přidat VŘ" pro vytvoření plánu</p>
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

                            {/* Sort items alphabetically by name */}
                            {[...items].sort((a, b) => a.name.localeCompare(b.name, 'cs')).map(item => {
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
                                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-${status.color}-500/20 text-${status.color}-400 border border-${status.color}-500/30`}>
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

                {/* Info */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-blue-400 text-[20px]">info</span>
                        <div>
                            <h4 className="font-semibold text-blue-300 text-sm mb-1">Jak to funguje</h4>
                            <ul className="text-xs text-blue-400/80 space-y-1">
                                <li>• Přidejte plánovaná výběrová řízení s termíny</li>
                                <li>• Kliknutím na "Vytvořit" přejdete do Výběrová řízení s předvyplněnými údaji</li>
                                <li>• Stav se automaticky aktualizuje dle stavu poptávky</li>
                            </ul>
                        </div>
                    </div>
                </div>
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
                message={importConflicts[0] ? (
                    `Položka "${importConflicts[0].existingItem.name}" už v plánu existuje, ale liší se termíny.\n\n` +
                    `Aktuální: ${importConflicts[0].existingItem.dateFrom || '—'} – ${importConflicts[0].existingItem.dateTo || '—'}\n` +
                    `Import: ${importConflicts[0].importItem.dateFrom || '—'} – ${importConflicts[0].importItem.dateTo || '—'}\n\n` +
                    `Chcete termíny aktualizovat?\n(Zbývá vyřešit: ${importConflicts.length})`
                ) : ''}
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
    );
};
