/**
 * CreateContactModal Component
 * Modal for creating a new contact/subcontractor from the pipeline.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useState } from "react";
import { Subcontractor, StatusConfig } from "../../types";
import { DEFAULT_STATUSES } from "../../config/constants";

export interface CreateContactModalProps {
    initialName: string;
    initialData?: Subcontractor; // For editing
    existingSpecializations: string[];
    statuses: StatusConfig[];
    onClose: () => void;
    onSave: (contact: Subcontractor) => void;
}

export const CreateContactModal: React.FC<CreateContactModalProps> = ({
    initialName,
    initialData,
    existingSpecializations,
    statuses,
    onClose,
    onSave,
}) => {
    // Fallback to DEFAULT_STATUSES if statuses is null, undefined, or empty
    const safeStatuses = statuses && statuses.length > 0 ? statuses : DEFAULT_STATUSES;

    // Helper to extract first contact info safely
    const primaryContact = initialData?.contacts?.[0] || { name: "", email: "", phone: "" };

    const [form, setForm] = useState({
        company: initialData ? initialData.company : initialName,
        name: primaryContact.name === "-" ? "" : primaryContact.name,
        email: primaryContact.email === "-" ? "" : primaryContact.email,
        phone: primaryContact.phone === "-" ? "" : primaryContact.phone,
        specializationRaw: "",
        ico: (initialData?.ico === "-" ? "" : initialData?.ico) || "",
        region: (initialData?.region === "-" ? "" : initialData?.region) || "",
        status: initialData?.status || "available",
    });
    const [specializations, setSpecializations] = useState<string[]>(
        initialData?.specialization || []
    );

    const handleAddSpec = (spec: string) => {
        const trimmed = spec.trim();
        if (!trimmed) return;
        if (specializations.includes(trimmed)) return;
        setSpecializations([...specializations, trimmed]);
        setForm({ ...form, specializationRaw: "" });
    };

    const handleRemoveSpec = (spec: string) => {
        setSpecializations(specializations.filter(s => s !== spec));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalSpecs = specializations.length > 0 ? specializations : ["Ostatní"];

        const contactToSave: Subcontractor = {
            id: initialData?.id || crypto.randomUUID(),
            company: form.company,
            specialization: finalSpecs,
            contacts: [{
                id: initialData?.contacts?.[0]?.id || crypto.randomUUID(),
                name: form.name || "-",
                email: form.email || "-",
                phone: form.phone || "-",
                position: "Hlavní kontakt"
            }],
            ico: form.ico || "-",
            region: form.region || "-",
            status: form.status || "available",
            // Mirror legacy fields for compatibility
            name: form.name || "-",
            email: form.email || "-",
            phone: form.phone || "-",
        };
        onSave(contactToSave);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {initialData ? "Upravit dodavatele" : "Nový dodavatel"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Firma / Název *
                            </label>
                            <input
                                required
                                type="text"
                                value={form.company}
                                onChange={(e) => setForm({ ...form, company: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                Specializace / Typ *
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {specializations.map(spec => (
                                    <span
                                        key={spec}
                                        className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30"
                                    >
                                        {spec}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSpec(spec)}
                                            className="hover:text-red-400 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </span>
                                ))}
                                {specializations.length === 0 && (
                                    <span className="text-xs text-slate-500 italic">Přidejte alespoň jednu specializaci</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        list="pipeline-specializations-list"
                                        value={form.specializationRaw}
                                        onChange={(e) =>
                                            setForm({ ...form, specializationRaw: e.target.value })
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddSpec(form.specializationRaw);
                                            }
                                            e.stopPropagation();
                                        }}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                        placeholder="Přidat specializaci (Enter)"
                                    />
                                    <datalist id="pipeline-specializations-list">
                                        {existingSpecializations.filter(s => !specializations.includes(s)).map(spec => (
                                            <option key={spec} value={spec} />
                                        ))}
                                    </datalist>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAddSpec(form.specializationRaw)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Kontaktní osoba
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Telefon
                                </label>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    IČO
                                </label>
                                <input
                                    type="text"
                                    value={form.ico}
                                    onChange={(e) => setForm({ ...form, ico: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                    placeholder="12345678"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Region
                                </label>
                                <input
                                    type="text"
                                    value={form.region}
                                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                    placeholder="Praha, Brno..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Stav
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                            >
                                {safeStatuses.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-medium hover:bg-slate-600/50 transition-colors"
                        >
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
                        >
                            {initialData ? "Uložit změny" : "Vytvořit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
