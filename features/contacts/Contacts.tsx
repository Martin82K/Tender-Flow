import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/shared/ui/Header';
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import { StarRating } from '@/shared/ui/StarRating';
import { Subcontractor, StatusConfig } from '@/types';
import { findCompanyRegistrationDetails } from '@/services/geminiService';
import { SubcontractorSelector } from '@/shared/ui/SubcontractorSelector';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { validateSubcontractorCompanyName } from '@/shared/dochub/subcontractorNameRules';
import { shellAdapter } from '@/services/platformAdapter';
import { isDesktop } from '@/services/platformAdapter';
import { CZ_REGIONS } from '@/config/constants';
import { useFeatures } from '@/context/FeatureContext';
import { FEATURES } from '@/config/features';
import { SubcontractorMapView } from '@features/maps/components/SubcontractorMapView';

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
    // View mode: list or map
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const { hasFeature } = useFeatures();
    const hasMapFeature = hasFeature(FEATURES.MODULE_MAPS);

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

    // Bulk Specialization Modal State
    const [isBulkSpecModalOpen, setIsBulkSpecModalOpen] = useState(false);
    const [bulkSpecMode, setBulkSpecMode] = useState<'add' | 'remove' | 'replace'>('add');
    const [bulkSpecSelected, setBulkSpecSelected] = useState<string[]>([]);
    const [bulkSpecRaw, setBulkSpecRaw] = useState('');

    // Form State
    const [formData, setFormData] = useState<Partial<Subcontractor> & { specializationRaw?: string }>({
        company: '',
        specialization: [],
        contacts: [],
        ico: '',
        region: '',
        address: '',
        city: '',
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
                const nextCity = registration.city && !isBlankLookupValue(registration.city)
                    ? registration.city : c.city;

                const regionChanged = (isBlankLookupValue(c.region) ? '' : c.region?.trim() || '') !== (isBlankLookupValue(nextRegion) ? '' : nextRegion?.trim() || '');
                const addressChanged = (isBlankLookupValue(c.address) ? '' : c.address?.trim() || '') !== (isBlankLookupValue(nextAddress) ? '' : nextAddress?.trim() || '');
                const cityChanged = (isBlankLookupValue(c.city) ? '' : c.city?.trim() || '') !== (isBlankLookupValue(nextCity) ? '' : nextCity?.trim() || '');

                if (regionChanged || addressChanged || cityChanged) {
                    changedContacts.push({ ...c, region: nextRegion, address: nextAddress, city: nextCity });
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
            (isBlankLookupValue(c.region) || isBlankLookupValue(c.address) || isBlankLookupValue(c.city)) &&
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
                (isBlankLookupValue(c.region) || isBlankLookupValue(c.address) || isBlankLookupValue(c.city)),
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
                const nextCity = registration.city && !isBlankLookupValue(registration.city)
                    ? registration.city : contact.city;

                const originalRegion = isBlankLookupValue(contact.region) ? '' : contact.region?.trim() || '';
                const newRegion = isBlankLookupValue(nextRegion) ? '' : nextRegion?.trim() || '';
                const originalAddress = isBlankLookupValue(contact.address) ? '' : contact.address?.trim() || '';
                const newAddress = isBlankLookupValue(nextAddress) ? '' : nextAddress?.trim() || '';
                const originalCity = isBlankLookupValue(contact.city) ? '' : contact.city?.trim() || '';
                const newCity = isBlankLookupValue(nextCity) ? '' : nextCity?.trim() || '';

                if (originalRegion === newRegion && originalAddress === newAddress && originalCity === newCity) {
                    lookupFailCount++;
                    failedCompanies.push(contact.company);
                    continue;
                }

                lookupSuccessCount++;

                try {
                    await onBulkUpdateContacts([{ ...contact, region: nextRegion, address: nextAddress, city: nextCity }]);
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
                city:
                    registration.city && (overwriteExisting || isBlankLookupValue(prev.city))
                        ? registration.city
                        : prev.city,
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

    const handleOpenBulkSpecModal = () => {
        setBulkSpecMode('add');
        setBulkSpecSelected([]);
        setBulkSpecRaw('');
        setIsBulkSpecModalOpen(true);
    };

    const handleBulkSpecAdd = (spec: string) => {
        const trimmed = spec.trim();
        if (!trimmed || bulkSpecSelected.includes(trimmed)) return;
        setBulkSpecSelected(prev => [...prev, trimmed]);
        setBulkSpecRaw('');
    };

    const handleBulkSpecRemoveTag = (spec: string) => {
        setBulkSpecSelected(prev => prev.filter(s => s !== spec));
    };

    const handleBulkSpecApply = async () => {
        if (selectedIds.size === 0 || bulkSpecSelected.length === 0) return;

        const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
        const updatedContacts: Subcontractor[] = selectedContacts.map(contact => {
            let newSpecs: string[];
            if (bulkSpecMode === 'add') {
                const existing = new Set(contact.specialization || []);
                bulkSpecSelected.forEach(s => existing.add(s));
                newSpecs = Array.from(existing) as string[];
            } else if (bulkSpecMode === 'remove') {
                const toRemove = new Set(bulkSpecSelected);
                newSpecs = (contact.specialization || []).filter(s => !toRemove.has(s));
            } else {
                newSpecs = [...bulkSpecSelected];
            }
            return { ...contact, specialization: newSpecs };
        });

        await onBulkUpdateContacts(updatedContacts);
        setIsBulkSpecModalOpen(false);
        setSelectedIds(new Set());
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
            city: '',
            web: '',
            note: '',
            regions: [],
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
            city: formData.city || '-',
            web: formData.web || '',
            note: formData.note || '',
            regions: formData.regions || [],
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
                (isBlankLookupValue(savedContact.region) || isBlankLookupValue(savedContact.address) || isBlankLookupValue(savedContact.city))) {
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
    const allSpecializations = (Array.from(new Set(contacts.flatMap(c => c.specialization))) as string[]).sort();
    const companyValidation = validateSubcontractorCompanyName(formData.company || '');
    const companyError = formData.company && !companyValidation.isValid ? companyValidation.reason : null;
    const isSaveDisabled = !formData.company || !formData.specialization || formData.specialization.length === 0 || !companyValidation.isValid;

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Kontakty" subtitle={`Celkem ${contacts.length} subdodavatelů`} helpSlot={<HelpButton />} notificationSlot={<NotificationBell />}>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 ? (
                        <div data-help-id="contacts-bulk-actions" className="flex items-center gap-2 animate-fade-in bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800">
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
                                onClick={handleOpenBulkSpecModal}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                Upravit specializace
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
                    {hasMapFeature && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">list</span>
                                Seznam
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'map' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">map</span>
                                Mapa
                            </button>
                        </div>
                    )}
                    <button
                        data-help-id="contacts-add"
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Přidat kontakt
                    </button>
                </div>
            </Header>

            {viewMode === 'list' ? (
                <div data-help-id="contacts-list" className="p-6 lg:p-10 flex-1 flex flex-col min-h-0">
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
            ) : (
                <div className="flex-1 min-h-0">
                    <SubcontractorMapView
                        contacts={contacts}
                        statuses={statuses}
                        onContactClick={handleOpenEditModal}
                    />
                </div>
            )}

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
                                                    if (isBlankLookupValue(formData.region) || isBlankLookupValue(formData.address) || isBlankLookupValue(formData.city)) {
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

                                    {/* City */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Město</label>
                                        <input
                                            type="text"
                                            value={formData.city || ''}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Město sídla firmy"
                                        />
                                    </div>

                                    {/* Web */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Web</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                value={formData.web || ''}
                                                onChange={e => setFormData({ ...formData, web: e.target.value })}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="flex-1 min-w-0 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                                placeholder="https://www.example.cz"
                                            />
                                            {formData.web && formData.web.trim() && (
                                                <a
                                                    href={formData.web.trim().startsWith('http') ? formData.web.trim() : `https://${formData.web.trim()}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium whitespace-nowrap transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isDesktop) {
                                                            e.preventDefault();
                                                            const url = formData.web!.trim().startsWith('http') ? formData.web!.trim() : `https://${formData.web!.trim()}`;
                                                            shellAdapter.openExternal(url).catch(err =>
                                                                console.warn('Nepodařilo se otevřít odkaz:', err)
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Web
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Regions - Kraje ČR */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Kraje působnosti</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {/* Celá ČR toggle */}
                                            {(() => {
                                                const allCodes = CZ_REGIONS.map(r => r.code);
                                                const current = formData.regions || [];
                                                const allSelected = allCodes.every(code => current.includes(code));
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                regions: allSelected ? [] : [...allCodes],
                                                            });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                                                            allSelected
                                                                ? 'bg-primary text-white shadow-sm'
                                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                                        }`}
                                                    >
                                                        Celá ČR
                                                    </button>
                                                );
                                            })()}
                                            {CZ_REGIONS.map(r => {
                                                const isSelected = (formData.regions || []).includes(r.code);
                                                return (
                                                    <button
                                                        key={r.code}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = formData.regions || [];
                                                            setFormData({
                                                                ...formData,
                                                                regions: isSelected
                                                                    ? current.filter(c => c !== r.code)
                                                                    : [...current, r.code],
                                                            });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                                            isSelected
                                                                ? 'bg-primary text-white shadow-sm'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {r.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Poznámka */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Poznámka</label>
                                        <textarea
                                            value={formData.note || ''}
                                            onChange={e => setFormData({ ...formData, note: e.target.value })}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            rows={3}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-y"
                                            placeholder="Vlastní poznámky k dodavateli..."
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
            {/* Bulk Specialization Modal */}
            {isBulkSpecModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Hromadná úprava specializací
                                <span className="ml-2 text-sm font-normal text-slate-500">({selectedIds.size} kontaktů)</span>
                            </h3>
                            <button onClick={() => setIsBulkSpecModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {/* Mode selector */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Akce</label>
                                <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                                    {([
                                        { value: 'add' as const, label: 'Přidat', icon: 'add_circle' },
                                        { value: 'remove' as const, label: 'Odebrat', icon: 'remove_circle' },
                                        { value: 'replace' as const, label: 'Nahradit', icon: 'swap_horiz' },
                                    ]).map(item => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setBulkSpecMode(item.value)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium transition-colors ${
                                                bulkSpecMode === item.value
                                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                    {bulkSpecMode === 'add' && 'Přidá vybrané specializace ke stávajícím u všech vybraných kontaktů.'}
                                    {bulkSpecMode === 'remove' && 'Odebere vybrané specializace ze všech vybraných kontaktů.'}
                                    {bulkSpecMode === 'replace' && 'Nahradí všechny stávající specializace vybraných kontaktů za nové.'}
                                </p>
                            </div>

                            {/* Selected specializations */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Specializace</label>
                                <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                                    {bulkSpecSelected.map(spec => (
                                        <span
                                            key={spec}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                                bulkSpecMode === 'remove'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-primary/10 text-primary'
                                            }`}
                                        >
                                            {spec}
                                            <button type="button" onClick={() => handleBulkSpecRemoveTag(spec)} className="hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {bulkSpecSelected.length === 0 && (
                                        <span className="text-xs text-slate-400 italic">Vyberte specializace níže</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            list="bulk-available-specializations"
                                            value={bulkSpecRaw}
                                            onChange={e => setBulkSpecRaw(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleBulkSpecAdd(bulkSpecRaw);
                                                }
                                                e.stopPropagation();
                                            }}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="Přidat specializaci (stiskněte Enter)"
                                        />
                                        <datalist id="bulk-available-specializations">
                                            {allSpecializations.filter(s => !bulkSpecSelected.includes(s)).map(spec => (
                                                <option key={spec} value={spec} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleBulkSpecAdd(bulkSpecRaw)}
                                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Quick select from existing specializations */}
                            {allSpecializations.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Rychlý výběr</label>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                        {allSpecializations.map(spec => {
                                            const isSelected = bulkSpecSelected.includes(spec);
                                            return (
                                                <button
                                                    key={spec}
                                                    type="button"
                                                    onClick={() => isSelected ? handleBulkSpecRemoveTag(spec) : handleBulkSpecAdd(spec)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                                        isSelected
                                                            ? 'bg-primary text-white border-primary'
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'
                                                    }`}
                                                >
                                                    {spec}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsBulkSpecModalOpen(false)}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                Zrušit
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkSpecApply}
                                disabled={bulkSpecSelected.length === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    bulkSpecMode === 'remove'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-primary hover:bg-primary/90 text-white'
                                }`}
                            >
                                {bulkSpecMode === 'add' && `Přidat k ${selectedIds.size} kontaktům`}
                                {bulkSpecMode === 'remove' && `Odebrat z ${selectedIds.size} kontaktů`}
                                {bulkSpecMode === 'replace' && `Nahradit u ${selectedIds.size} kontaktů`}
                            </button>
                        </div>
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
