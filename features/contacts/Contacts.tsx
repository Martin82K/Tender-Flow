import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/shared/ui/Header';
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { StarRating } from '@/shared/ui/StarRating';
import { Subcontractor, StatusConfig } from '@/types';
import { findCompanyRegistrationDetails } from '@/services/geminiService';
import { SubcontractorSelector } from '@/shared/ui/SubcontractorSelector';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { validateSubcontractorCompanyName } from '@/shared/dochub/subcontractorNameRules';
import { shellAdapter } from '@/services/platformAdapter';
import { isDesktop } from '@/services/platformAdapter';

interface ContactsProps {
    statuses: StatusConfig[];
    contacts: Subcontractor[];
    onContactsChange: (contacts: Subcontractor[]) => void;
    onAddContact: (contact: Subcontractor) => void;
    onUpdateContact: (contact: Subcontractor) => void;
    onBulkUpdateContacts: (contacts: Subcontractor[]) => Promise<void> | void;
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
    const [isRegistrationLookupLoading, setIsRegistrationLookupLoading] = useState(false);

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
        address: '',
        status: 'available'
    });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmLabel?: string;
        variant?: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const isBlankLookupValue = (value?: string | null) => {
        if (!value) return true;
        const normalized = value.trim().toLowerCase();
        return normalized === '' || normalized === '-' || normalized === '–' || normalized === '—' || normalized === '―';
    };

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

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

    // --- Auto-fill registration data for contacts with IČO but missing region/address ---
    const autoFillProcessedRef = useRef<Set<string>>(new Set());

    const autoFillRegistrationForContacts = useCallback(async (contactsToLookup: Subcontractor[]) => {
        if (contactsToLookup.length === 0) return;

        // Mark as processed to avoid duplicate lookups
        contactsToLookup.forEach(c => autoFillProcessedRef.current.add(c.id));

        try {
            const queryList = contactsToLookup.map(c => ({ id: c.id, company: c.company, ico: c.ico }));
            const registrationMap = await findCompanyRegistrationDetails(queryList);

            const changedContacts: Subcontractor[] = [];
            for (const c of contactsToLookup) {
                const registration = registrationMap[c.id];
                if (!registration) continue;

                const nextRegion = registration.region && !isBlankLookupValue(registration.region)
                    ? registration.region : c.region;
                const nextAddress = registration.address && !isBlankLookupValue(registration.address)
                    ? registration.address : c.address;

                const regionChanged = (isBlankLookupValue(c.region) ? '' : c.region?.trim() || '') !== (isBlankLookupValue(nextRegion) ? '' : nextRegion?.trim() || '');
                const addressChanged = (isBlankLookupValue(c.address) ? '' : c.address?.trim() || '') !== (isBlankLookupValue(nextAddress) ? '' : nextAddress?.trim() || '');

                if (regionChanged || addressChanged) {
                    changedContacts.push({ ...c, region: nextRegion, address: nextAddress });
                }
            }

            if (changedContacts.length > 0) {
                await onBulkUpdateContacts(changedContacts);
            }
        } catch (error) {
            console.error('Auto-fill registračních údajů selhalo:', error);
        }
    }, [onBulkUpdateContacts]);

    // Auto-fill on mount / when contacts change - find contacts needing lookup
    useEffect(() => {
        const needsLookup = contacts.filter(c =>
            !!c.ico &&
            c.ico !== '-' &&
            (isBlankLookupValue(c.region) || isBlankLookupValue(c.address)) &&
            !autoFillProcessedRef.current.has(c.id)
        );

        if (needsLookup.length > 0) {
            void autoFillRegistrationForContacts(needsLookup);
        }
    }, [contacts, autoFillRegistrationForContacts]);

    // --- AI Handlers ---

    const handleAutoFillRegistrationData = async () => {
        if (selectedIds.size === 0) return;

        const contactsToProcess = contacts.filter(
            (c) =>
                selectedIds.has(c.id) &&
                !!c.ico &&
                c.ico !== '-' &&
                (isBlankLookupValue(c.region) || isBlankLookupValue(c.address)),
        );

        if (contactsToProcess.length === 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Informace',
                message: 'Žádné vybrané kontakty nemají IČO nebo už mají region i adresu vyplněné.',
                onConfirm: closeConfirmModal
            });
            return;
        }

        setIsRegionLoading(true);

        let lookupSuccessCount = 0;
        let lookupFailCount = 0;
        let saveSuccessCount = 0;
        let saveFailCount = 0;
        const failedCompanies: string[] = [];

        // Process each contact individually so one failure doesn't stop the rest
        for (const contact of contactsToProcess) {
            try {
                const registrationMap = await findCompanyRegistrationDetails([
                    { id: contact.id, company: contact.company, ico: contact.ico }
                ]);

                const registration = registrationMap[contact.id];
                if (!registration) {
                    lookupFailCount++;
                    failedCompanies.push(contact.company);
                    continue;
                }

                const nextRegion = registration.region && !isBlankLookupValue(registration.region)
                    ? registration.region : contact.region;
                const nextAddress = registration.address && !isBlankLookupValue(registration.address)
                    ? registration.address : contact.address;

                const originalRegion = isBlankLookupValue(contact.region) ? '' : contact.region?.trim() || '';
                const newRegion = isBlankLookupValue(nextRegion) ? '' : nextRegion?.trim() || '';
                const originalAddress = isBlankLookupValue(contact.address) ? '' : contact.address?.trim() || '';
                const newAddress = isBlankLookupValue(nextAddress) ? '' : nextAddress?.trim() || '';

                if (originalRegion === newRegion && originalAddress === newAddress) {
                    lookupFailCount++;
                    failedCompanies.push(contact.company);
                    continue;
                }

                lookupSuccessCount++;

                try {
                    await onBulkUpdateContacts([{ ...contact, region: nextRegion, address: nextAddress }]);
                    saveSuccessCount++;
                } catch (saveError) {
                    console.error('Chyba při ukládání kontaktu:', contact.company, saveError);
                    saveFailCount++;
                    failedCompanies.push(contact.company);
                }
            } catch (error) {
                console.error('Chyba při dohledání:', contact.company, error);
                lookupFailCount++;
                failedCompanies.push(contact.company);
            }
        }

        // Show summary modal
        const lines: string[] = [];
        lines.push(`Zpracováno: ${contactsToProcess.length} kontaktů`);
        if (saveSuccessCount > 0) {
            lines.push(`Doplněno: ${saveSuccessCount}`);
        }
        if (lookupFailCount > 0) {
            lines.push(`Bez výsledku z ARES: ${lookupFailCount}`);
        }
        if (saveFailCount > 0) {
            lines.push(`Chyba při ukládání: ${saveFailCount}`);
        }
        if (failedCompanies.length > 0 && failedCompanies.length <= 10) {
            lines.push('');
            lines.push(`Nedoplněno: ${failedCompanies.join(', ')}`);
        } else if (failedCompanies.length > 10) {
            lines.push('');
            lines.push(`Nedoplněno: ${failedCompanies.slice(0, 10).join(', ')} a dalších ${failedCompanies.length - 10}`);
        }

        setConfirmModal({
            isOpen: true,
            title: saveSuccessCount > 0 ? 'Doplnění dokončeno' : 'Informace',
            message: lines.join('\n'),
            onConfirm: closeConfirmModal
        });

        setIsRegionLoading(false);
        setSelectedIds(new Set());
    };

    const handleLookupRegistrationForForm = async (
        options: { overwriteExisting?: boolean; showNoResultMessage?: boolean } = {},
    ) => {
        const { overwriteExisting = false, showNoResultMessage = false } = options;

        if (!formData.ico || formData.ico === '-') {
            if (showNoResultMessage) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Informace',
                    message: 'Pro dohledání adresy a regionu nejdřív vyplňte platné IČO.',
                    onConfirm: closeConfirmModal
                });
            }
            return;
        }

        setIsRegistrationLookupLoading(true);

        try {
            const lookupKey = editingContact?.id || 'draft-subcontractor';
            const registrationMap = await findCompanyRegistrationDetails([
                {
                    id: lookupKey,
                    company: formData.company || 'Neznámá firma',
                    ico: formData.ico,
                }
            ]);
            const registration = registrationMap[lookupKey];

            if (!registration) {
                if (showNoResultMessage) {
                    setConfirmModal({
                        isOpen: true,
                        title: 'Informace',
                        message: 'Pro zadané IČO se nepodařilo dohledat adresu ani region v ARES.',
                        onConfirm: closeConfirmModal
                    });
                }
                return;
            }

            setFormData(prev => ({
                ...prev,
                region:
                    registration.region && (overwriteExisting || isBlankLookupValue(prev.region))
                        ? registration.region
                        : prev.region,
                address:
                    registration.address && (overwriteExisting || isBlankLookupValue(prev.address))
                        ? registration.address
                        : prev.address,
            }));
        } catch (error) {
            console.error('Chyba při dohledání adresy a regionu dle IČO:', error);
            if (showNoResultMessage) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Chyba',
                    message: 'Nepodařilo se dohledat registrační údaje dle IČO. Zkuste to znovu později.',
                    onConfirm: closeConfirmModal
                });
            }
        } finally {
            setIsRegistrationLookupLoading(false);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Smazat kontakty',
            message: `Opravdu chcete smazat ${selectedIds.size} vybraných kontaktů? Tato akce je nevratná.`,
            confirmLabel: 'Smazat',
            variant: 'danger',
            onConfirm: () => {
                onDeleteContacts(Array.from(selectedIds));
                setSelectedIds(new Set());
                closeConfirmModal();
            }
        });
    };

    // --- CRUD Handlers ---

    const handleOpenAddModal = () => {
        setFormData({
            company: '',
            specialization: [],
            contacts: [{ id: crypto.randomUUID(), name: '', phone: '', email: '', position: 'Hlavní kontakt' }],
            ico: '',
            region: '',
            address: '',
            status: 'available'
        });
        setIsContactModalOpen(true);
    };

    const handleOpenEditModal = (contact: Subcontractor) => {
        setEditingContact(contact);
        setFormData({ ...contact });
        setIsContactModalOpen(true);
    };

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.company || !formData.specialization || formData.specialization.length === 0) return;
        if (!companyValidation.isValid) return;

        const baseContact: Omit<Subcontractor, 'id'> = {
            company: formData.company!,
            specialization: formData.specialization!,
            contacts: formData.contacts || [],
            ico: formData.ico || '-',
            region: formData.region || '-',
            address: formData.address || '-',
            status: formData.status || 'available'
        };

        try {
            const contactId = editingContact ? editingContact.id : crypto.randomUUID();
            const savedContact = { ...baseContact, id: contactId } as Subcontractor;

            if (editingContact) {
                await onUpdateContact(savedContact);
            } else {
                await onAddContact(savedContact);
            }
            // Only close modal if no error was thrown
            setIsContactModalOpen(false);
            setEditingContact(null);

            // Auto-fill region/address from ARES if IČO is set but region/address is missing
            if (savedContact.ico && savedContact.ico !== '-' &&
                (isBlankLookupValue(savedContact.region) || isBlankLookupValue(savedContact.address))) {
                // Remove from processed set so the useEffect picks it up, or do it directly
                autoFillProcessedRef.current.delete(contactId);
                void autoFillRegistrationForContacts([savedContact]);
            }
        } catch (error) {
            console.error('Error saving contact:', error);
            // Modal stays open so user can see the error or retry
        }
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
            setConfirmModal({
                isOpen: true,
                title: 'Smazat kontakt',
                message: 'Opravdu chcete smazat tento kontakt? Tato akce je nevratná.',
                confirmLabel: 'Smazat',
                variant: 'danger',
                onConfirm: () => {
                    onDeleteContacts([editingContact.id]);
                    setIsContactModalOpen(false);
                    closeConfirmModal();
                }
            });
        }
    };

    // Get unique specializations for datalist (re-calculate here for the form, or export from selector? simpler to recalc)
    const allSpecializations = Array.from(new Set(contacts.flatMap(c => c.specialization))).sort();
    const companyValidation = validateSubcontractorCompanyName(formData.company || '');
    const companyError = formData.company && !companyValidation.isValid ? companyValidation.reason : null;
    const isSaveDisabled = !formData.company || !formData.specialization || formData.specialization.length === 0 || !companyValidation.isValid;

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Kontakty" subtitle={`Celkem ${contacts.length} subdodavatelů`} notificationSlot={<NotificationBell />}>
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
                                onClick={handleAutoFillRegistrationData}
                                disabled={isRegionLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                            >
                                {isRegionLoading ? (
                                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                                )}
                                Doplnit adresy a regiony
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
                                        {companyError && (
                                            <p className="mt-1 text-xs text-red-500">{companyError}</p>
                                        )}
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
                                            {(!formData.specialization || formData.specialization.length === 0) && (
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

                                    {/* IČO */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">IČO</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.ico || ''}
                                                onChange={e => setFormData({ ...formData, ico: e.target.value })}
                                                onBlur={() => {
                                                    if (isBlankLookupValue(formData.region) || isBlankLookupValue(formData.address)) {
                                                        void handleLookupRegistrationForForm({ overwriteExisting: false, showNoResultMessage: false });
                                                    }
                                                }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                                placeholder="IČO firmy"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleLookupRegistrationForForm({ overwriteExisting: true, showNoResultMessage: true })}
                                                disabled={isRegistrationLookupLoading}
                                                title="Dohledat adresu a region dle IČO"
                                                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${isRegistrationLookupLoading ? 'animate-spin' : ''}`}>
                                                    {isRegistrationLookupLoading ? 'sync' : 'travel_explore'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Region */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Region</label>
                                        <input
                                            type="text"
                                            value={formData.region || ''}
                                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Praha, Brno..."
                                        />
                                    </div>

                                    {/* Address */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Adresa</label>
                                        <input
                                            type="text"
                                            value={formData.address || ''}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Sídlo firmy dle registrace"
                                        />
                                    </div>

                                    {/* Registry Links */}
                                    {formData.ico && !isBlankLookupValue(formData.ico) && (
                                        <div className="col-span-2 flex items-center gap-1.5">
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-1">Rejstříky:</span>
                                            {[
                                                { label: 'ARES', url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${formData.ico.trim()}` },
                                                { label: 'RŽP', url: `https://rzp.gov.cz/portal/cs/vyhledani?q=${formData.ico.trim()}` },
                                                { label: 'RES', url: `https://or.justice.cz/ias/ui/rejstrik-${'$'}firma?ico=${formData.ico.trim()}` },
                                            ].map(link => (
                                                <a
                                                    key={link.label}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => {
                                                        if (isDesktop) {
                                                            e.preventDefault();
                                                            shellAdapter.openExternal(link.url).catch(err =>
                                                                console.warn('Nepodařilo se otevřít odkaz:', err)
                                                            );
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                >
                                                    {link.label}
                                                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}

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
                                                        Přidat první osobu
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status / Rating */}
                                    <div className="col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Hodnocení dodavatele</label>
                                        <div className="flex items-center gap-3 mb-4">
                                            {editingContact?.vendorRatingAverage !== undefined && editingContact?.vendorRatingAverage !== null ? (
                                                <div
                                                    className="inline-flex items-center gap-2"
                                                    title={editingContact.vendorRatingCount ? `Hodnoceno: ${editingContact.vendorRatingCount}×` : undefined}
                                                >
                                                    <StarRating value={editingContact.vendorRatingAverage} readOnly size="sm" />
                                                    <span className="text-xs text-slate-500">
                                                        {editingContact.vendorRatingAverage.toFixed(1)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">Neohodnoceno</span>
                                            )}
                                        </div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Stav kontaktu</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={formData.status || 'available'}
                                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            >
                                                {statuses.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
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
                                        disabled={isSaveDisabled}
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {editingContact ? 'Uložit změny' : 'Vytvořit kontakt'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                confirmLabel={confirmModal.confirmLabel || 'OK'}
                variant={confirmModal.variant || 'info'}
            />
        </div>
    );
};
