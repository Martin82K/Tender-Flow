import React, { useState, useEffect } from 'react';
import { TenderPlanItem, DemandCategory } from '../types';

interface TenderPlanProps {
    projectId: string;
    categories: DemandCategory[];
    onCreateCategory: (name: string, dateFrom: string, dateTo: string) => void;
}

export const TenderPlan: React.FC<TenderPlanProps> = ({ projectId, categories, onCreateCategory }) => {
    const [items, setItems] = useState<TenderPlanItem[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDateFrom, setFormDateFrom] = useState('');
    const [formDateTo, setFormDateTo] = useState('');

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`tenderPlan_${projectId}`);
        if (saved) {
            try {
                setItems(JSON.parse(saved));
            } catch {
                setItems([]);
            }
        }
    }, [projectId]);

    // Save to localStorage
    const saveItems = (newItems: TenderPlanItem[]) => {
        setItems(newItems);
        localStorage.setItem(`tenderPlan_${projectId}`, JSON.stringify(newItems));
    };

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

    const handleAdd = () => {
        if (!formName.trim()) return;

        const newItem: TenderPlanItem = {
            id: `tp_${Date.now()}`,
            name: formName.trim(),
            dateFrom: formDateFrom,
            dateTo: formDateTo,
        };

        saveItems([...items, newItem]);
        resetForm();
    };

    const handleEdit = (item: TenderPlanItem) => {
        setEditingId(item.id);
        setFormName(item.name);
        setFormDateFrom(item.dateFrom);
        setFormDateTo(item.dateTo);
    };

    const handleUpdate = () => {
        if (!editingId || !formName.trim()) return;

        const updated = items.map(item =>
            item.id === editingId
                ? { ...item, name: formName.trim(), dateFrom: formDateFrom, dateTo: formDateTo }
                : item
        );

        saveItems(updated);
        resetForm();
    };

    const handleDelete = (id: string) => {
        if (!confirm('Opravdu smazat tento plán?')) return;
        saveItems(items.filter(item => item.id !== id));
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

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
            <div className="max-w-5xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-400 text-2xl">event_note</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Plán výběrových řízení</h2>
                            <p className="text-sm text-slate-400">Plánování a sledování VŘ</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Přidat VŘ
                    </button>
                </div>

                {/* Table */}
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Název VŘ</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Od</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Do</th>
                                <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Poptávka</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stav</th>
                                <th className="text-right px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && !isAdding && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">calendar_month</span>
                                        <p className="text-slate-400 text-sm">Zatím nemáte žádná plánovaná VŘ</p>
                                        <p className="text-slate-500 text-xs mt-1">Klikněte na "Přidat VŘ" pro vytvoření plánu</p>
                                    </td>
                                </tr>
                            )}

                            {items.map(item => {
                                const status = getStatus(item);
                                const hasCategory = !!findLinkedCategory(item);
                                const isEditing = editingId === item.id;

                                if (isEditing) {
                                    return (
                                        <tr key={item.id} className="border-b border-slate-700/30 bg-slate-800/30">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formName}
                                                    onChange={(e) => setFormName(e.target.value)}
                                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
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
                                    <tr key={item.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-white">{item.name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-300">
                                                {item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('cs-CZ') : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-300">
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

                            {/* Add new row */}
                            {isAdding && (
                                <tr className="border-b border-slate-700/30 bg-slate-800/30">
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                            placeholder="Název VŘ"
                                            autoFocus
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
        </div>
    );
};
