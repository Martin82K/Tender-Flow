import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Subcontractor, StatusConfig } from '../types';
import { findCompanyRegions } from '../services/geminiService';
import { SubcontractorSelector } from './SubcontractorSelector';

interface ContactsProps {
    statuses: StatusConfig[];
    contacts: Subcontractor[];
    onContactsChange: (contacts: Subcontractor[]) => void;
    onAddContact: (contact: Subcontractor) => void;
    onUpdateContact: (contact: Subcontractor) => void;
    onBulkUpdateContacts: (contacts: Subcontractor[]) => void;
    onDeleteContacts: (ids: string[]) => void;
    isAdmin?: boolean;
}

export const Contacts: React.FC<ContactsProps> = ({ statuses, contacts, onContactsChange, onAddContact, onUpdateContact, onBulkUpdateContacts, onDeleteContacts, isAdmin = false }) => {
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filtered Data State (received from child)
    const [filteredContacts, setFilteredContacts] = useState<Subcontractor[]>(contacts);

    // AI Region State
    const [isRegionLoading, setIsRegionLoading] = useState(false);

    // Contact Modal State
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Subcontractor | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Subcontractor> & { specializationRaw?: string }>({
        company: '',
        specialization: [],
        contacts: [],
        ico: '',
        region: '',
        status: 'available'
    });

    // Keep editingContact in sync with updated contacts
    useEffect(() => {
        if (editingContact) {
            const updatedContact = contacts.find(c => c.id === editingContact.id);
            if (updatedContact) {
                setEditingContact(updatedContact);
                setFormData({ ...updatedContact });
            }
        }
    }, [contacts, editingContact?.id]);

    // --- AI Handlers ---

    const handleAutoFillRegions = async () => {
        if (selectedIds.size === 0) return;

        const contactsToProcess = contacts.filter(c => selectedIds.has(c.id) && c.ico && c.ico !== '-' && (!c.region || c.region === '-'));

        if (contactsToProcess.length === 0) {
            alert("Žádné vybrané kontakty nemají IČO nebo již mají region vyplněný.");
            return;
        }

        setIsRegionLoading(true);

        // Prepare data for AI
        const queryList = contactsToProcess.map(c => ({ id: c.id, company: c.company, ico: c.ico }));

        const regionsMap = await findCompanyRegions(queryList);

        // Update props via handler
        const updatedContacts = contacts.map(c => {
            if (regionsMap[c.id]) {
                return { ...c, region: regionsMap[c.id] };
            }
            return c;
        });

        // Filter only changed contacts for bulk update
        const changedContacts = updatedContacts.filter(c => {
            const original = contacts.find(orig => orig.id === c.id);
            return original && original.region !== c.region;
        });

        if (changedContacts.length > 0) {
            onBulkUpdateContacts(changedContacts);
        }

        setIsRegionLoading(false);
        setSelectedIds(new Set()); // Clear selection
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;

        if (confirm(`Opravdu chcete smazat ${selectedIds.size} vybraných kontaktů?`)) {
            onDeleteContacts(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    // --- CRUD Handlers ---

    const handleOpenAddModal = () => {
        setFormData({
            company: '',
            specialization: [],
            contacts: [{ id: crypto.randomUUID(), name: '', phone: '', email: '', position: 'Hlavní kontakt' }],
            ico: '',
            region: '',
            status: 'available'
        });
        setIsContactModalOpen(true);
    };

    const handleOpenEditModal = (contact: Subcontractor) => {
        setEditingContact(contact);
        setFormData({ ...contact });
        setIsContactModalOpen(true);
    };

    const handleSaveContact = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.company || !formData.specialization || formData.specialization.length === 0) return;

        const baseContact: Omit<Subcontractor, 'id'> = {
            company: formData.company!,
            specialization: formData.specialization!,
            contacts: formData.contacts || [],
            ico: formData.ico || '-',
            region: formData.region || '-',
            status: formData.status || 'available'
        };

        if (editingContact) {
            onUpdateContact({ ...baseContact, id: editingContact.id } as Subcontractor);
        } else {
            onAddContact({ ...baseContact, id: crypto.randomUUID() } as Subcontractor);
        }
        setIsContactModalOpen(false);
    };

    const handleAddContactPerson = () => {
        const newContact = {
            id: crypto.randomUUID(),
            name: '',
            phone: '',
            email: '',
            position: ''
        };
        setFormData(prev => ({
            ...prev,
            contacts: [...(prev.contacts || []), newContact]
        }));
    };

    const handleRemoveContactPerson = (id: string) => {
        setFormData(prev => ({
            ...prev,
            contacts: (prev.contacts || []).filter(c => c.id !== id)
        }));
    };

    const handleUpdateContactPerson = (id: string, updates: any) => {
        setFormData(prev => ({
            ...prev,
            contacts: (prev.contacts || []).map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    };

    const handleAddSpecialization = (spec: string) => {
        const trimmed = spec.trim();
        if (!trimmed) return;
        if (formData.specialization?.includes(trimmed)) return;
        
        setFormData(prev => ({
            ...prev,
            specialization: [...(prev.specialization || []), trimmed],
            specializationRaw: '' // Clear input
        }));
    };

    const handleRemoveSpecialization = (spec: string) => {
        setFormData(prev => ({
            ...prev,
            specialization: (prev.specialization || []).filter(s => s !== spec)
        }));
    };

    const handleDeleteContact = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (editingContact) {
            // Use setTimeout to decouple from the click event loop
            // This fixes issues where the confirm dialog closes immediately in some browsers
            setTimeout(() => {
                if (window.confirm('Opravdu chcete smazat tento kontakt?')) {
                    onDeleteContacts([editingContact.id]);
                    setIsContactModalOpen(false);
                }
            }, 100);
        }
    };

    // Get unique specializations for datalist (re-calculate here for the form, or export from selector? simpler to recalc)
    const allSpecializations = Array.from(new Set(contacts.flatMap(c => c.specialization))).sort();

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Kontakty" subtitle={`Celkem ${contacts.length} subdodavatelů`}>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 ? (
                        <div className="flex items-center gap-2 animate-fade-in bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800">
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300 mr-2">
                                {selectedIds.size} vybráno
                            </span>
                            <button
                                onClick={handleDeleteSelected}
                                className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors mr-2"
                                title="Smazat vybrané"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                            <button
                                onClick={handleAutoFillRegions}
                                disabled={isRegionLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                            >
                                {isRegionLoading ? (
                                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                                )}
                                Doplnit regiony (AI)
                            </button>
                        </div>
                    ) : null}
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Přidat kontakt
                    </button>
                </div>
            </Header>

            <div className="p-6 lg:p-10 flex-1 flex flex-col min-h-0">
                <SubcontractorSelector
                    contacts={contacts}
                    statuses={statuses}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onFilteredContactsChange={setFilteredContacts}
                    onEditContact={handleOpenEditModal}
                    className="flex-1 min-h-0"
                />
            </div>

            {/* Contact Modal (Add / Edit) */}
            {isContactModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingContact ? 'Upravit kontakt' : 'Přidat nový kontakt'}
                            </h3>
                            <button onClick={() => setIsContactModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveContact} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto flex-1 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Company */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Firma / Dodavatel *</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.company}
                                            onChange={e => setFormData({ ...formData, company: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Název firmy"
                                        />
                                    </div>

                                    {/* Specialization */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Specializace / Typ *</label>
                                        
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {formData.specialization?.map(spec => (
                                                <span 
                                                    key={spec} 
                                                    className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold"
                                                >
                                                    {spec}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveSpecialization(spec)}
                                                        className="hover:text-red-500 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                </span>
                                            ))}
                                            {( !formData.specialization || formData.specialization.length === 0 ) && (
                                                <span className="text-xs text-slate-400 italic">Žádná specializace vybrána</span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    list="available-specializations"
                                                    value={formData.specializationRaw || ''}
                                                    onChange={e => setFormData({ ...formData, specializationRaw: e.target.value })}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddSpecialization(formData.specializationRaw || '');
                                                        }
                                                        e.stopPropagation();
                                                    }}
                                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                                    placeholder="Přidat specializaci (stiskněte Enter)"
                                                />
                                                <datalist id="available-specializations">
                                                    {allSpecializations.filter(s => !formData.specialization?.includes(s)).map(spec => (
                                                        <option key={spec} value={spec} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddSpecialization(formData.specializationRaw || '')}
                                                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">add</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Region */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Region</label>
                                        <input
                                            type="text"
                                            value={formData.region}
                                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Praha, Brno..."
                                        />
                                    </div>

                                    {/* Contacts Section */}
                                    <div className="col-span-2 mt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kontaktní osoby</h4>
                                            <button
                                                type="button"
                                                onClick={handleAddContactPerson}
                                                className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">add</span>
                                                Přidat osobu
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {formData.contacts?.map((contact, index) => (
                                                <div key={contact.id} className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 group">
                                                    {formData.contacts!.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveContactPerson(contact.id)}
                                                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jméno *</label>
                                                            <input
                                                                required
                                                                type="text"
                                                                value={contact.name}
                                                                onChange={e => handleUpdateContactPerson(contact.id, { name: e.target.value })}
                                                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm dark:text-white"
                                                                placeholder="Jméno a Příjmení"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pozice</label>
                                                            <input
                                                                type="text"
                                                                value={contact.position || ''}
                                                                onChange={e => handleUpdateContactPerson(contact.id, { position: e.target.value })}
                                                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm dark:text-white"
                                                                placeholder="Např. Obchodní zástupce"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefon</label>
                                                            <input
                                                                type="text"
                                                                value={contact.phone}
                                                                onChange={e => handleUpdateContactPerson(contact.id, { phone: e.target.value })}
                                                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm dark:text-white"
                                                                placeholder="+420 ..."
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                                                            <input
                                                                type="email"
                                                                value={contact.email}
                                                                onChange={e => handleUpdateContactPerson(contact.id, { email: e.target.value })}
                                                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm dark:text-white"
                                                                placeholder="email@example.com"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.contacts || formData.contacts.length === 0) && (
                                                <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                                    <p className="text-sm text-slate-500">Žádné kontaktní osoby nebyly přidány.</p>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddContactPerson}
                                                        className="mt-2 text-xs font-bold text-primary"
                                                    >
                                                        Pridat první osobu
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                                {editingContact ? (
                                    <button
                                        type="button"
                                        onClick={handleDeleteContact}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1"
                                    >
                                        Smazat kontakt
                                    </button>
                                ) : (
                                    <div></div> // Spacer
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsContactModalOpen(false)}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Zrušit
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                                    >
                                        {editingContact ? 'Uložit změny' : 'Vytvořit kontakt'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

