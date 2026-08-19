/**
 * CreateContactModal Component
 * Modal for creating/editing a subcontractor from the pipeline.
 * Mirrors the detailed form used in the standard Contacts view
 * (features/contacts/Contacts.tsx) so that users see the same fields
 * (adresa, město, web, kraje působnosti, poznámka, více kontaktních osob,
 * ARES lookup, rejstříky) regardless of where they edit a supplier.
 */

import React, { useState, useMemo } from "react";
import type { StatusConfig, Subcontractor } from "@/types";
import { CZ_REGIONS, DEFAULT_STATUSES } from "@/config/constants";
import { validateSubcontractorCompanyName } from "@shared/dochub/subcontractorNameRules";
import { AutocompleteInput } from "@shared/ui/AutocompleteInput";
import { StarRating } from "@shared/ui/StarRating";
import { formatDecimal } from "@shared/formatting/decimalFormatters";
import { findCompanyRegistrationDetails } from "@/services/geminiService";
import { isDesktop, shellAdapter } from "@infra/platform/platformAdapter";
import { PipelineRegistryLinks } from "@features/projects/pipeline/ui/PipelineRegistryLinks";
import { PipelineContactPersonsEditor } from "@features/projects/pipeline/ui/PipelineContactPersonsEditor";
import {
    createPipelineContactFormState,
    isBlankRegistrationValue,
    mergeRegistrationDetails,
    type PipelineContactFormState,
} from "@features/projects/pipeline/model/pipelineContactFormModel";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";

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
    const safeStatuses = statuses && statuses.length > 0 ? statuses : DEFAULT_STATUSES;

    const [formData, setFormData] = useState<PipelineContactFormState>(() =>
        createPipelineContactFormState(initialData, initialName, () => crypto.randomUUID()),
    );
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupMessage, setLookupMessage] = useState<{
        kind: "info" | "error";
        text: string;
    } | null>(null);

    const specializations = formData.specialization || [];
    const contactPersons = formData.contacts || [];
    const selectedRegions = formData.regions || [];
    const companyValidation = useMemo(
        () => validateSubcontractorCompanyName(formData.company || ""),
        [formData.company],
    );
    const companyError =
        formData.company && !companyValidation.isValid ? companyValidation.reason : null;
    const isSubmitDisabled =
        !formData.company?.trim() ||
        !companyValidation.isValid ||
        specializations.length === 0;

    const handleAddSpecialization = (spec: string) => {
        const trimmed = spec.trim();
        if (!trimmed) return;
        if (specializations.includes(trimmed)) {
            setFormData(prev => ({ ...prev, specializationRaw: "" }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            specialization: [...(prev.specialization || []), trimmed],
            specializationRaw: "",
        }));
    };

    const handleRemoveSpecialization = (spec: string) => {
        setFormData(prev => ({
            ...prev,
            specialization: (prev.specialization || []).filter(s => s !== spec),
        }));
    };

    const toggleRegion = (code: string) => {
        setFormData(prev => {
            const current = prev.regions || [];
            return {
                ...prev,
                regions: current.includes(code)
                    ? current.filter(c => c !== code)
                    : [...current, code],
            };
        });
    };

    const toggleAllRegions = () => {
        const allCodes = CZ_REGIONS.map(r => r.code);
        const current = formData.regions || [];
        const allSelected = allCodes.every(code => current.includes(code));
        setFormData(prev => ({
            ...prev,
            regions: allSelected ? [] : [...allCodes],
        }));
    };

    const handleLookupRegistration = async (
        options: { overwriteExisting?: boolean; showNoResultMessage?: boolean } = {},
    ) => {
        const { overwriteExisting = false, showNoResultMessage = false } = options;

        if (!formData.ico || isBlankRegistrationValue(formData.ico)) {
            if (showNoResultMessage) {
                setLookupMessage({
                    kind: "error",
                    text: "Pro dohledání adresy a regionu nejdřív vyplňte platné IČO.",
                });
            }
            return;
        }

        setLookupLoading(true);
        setLookupMessage(null);
        try {
            const lookupKey = initialData?.id || "draft-subcontractor";
            const registrationMap = await findCompanyRegistrationDetails([
                {
                    id: lookupKey,
                    company: formData.company || "Neznámá firma",
                    ico: formData.ico,
                },
            ]);
            const registration = registrationMap[lookupKey];

            if (!registration) {
                if (showNoResultMessage) {
                    setLookupMessage({
                        kind: "error",
                        text: "Pro zadané IČO se nepodařilo dohledat adresu ani region v ARES.",
                    });
                }
                return;
            }

            setFormData(prev =>
                mergeRegistrationDetails(prev, registration, overwriteExisting),
            );
            setLookupMessage({
                kind: "info",
                text: "Registrační údaje byly dohledány.",
            });
        } catch (error) {
            console.error("Chyba při dohledání adresy a regionu dle IČO:", error);
            if (showNoResultMessage) {
                setLookupMessage({
                    kind: "error",
                    text: "Nepodařilo se dohledat registrační údaje dle IČO. Zkuste to znovu později.",
                });
            }
        } finally {
            setLookupLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitDisabled) return;

        const finalSpecs =
            specializations.length > 0 ? specializations : ["Ostatní"];

        const primaryContact = contactPersons[0];
        const contactToSave: Subcontractor = {
            id: initialData?.id || crypto.randomUUID(),
            company: formData.company!.trim(),
            specialization: finalSpecs,
            contacts: contactPersons,
            ico: formData.ico?.trim() || "-",
            region: formData.region?.trim() || "-",
            address: formData.address?.trim() || "-",
            city: formData.city?.trim() || "-",
            web: formData.web?.trim() || "",
            note: formData.note || "",
            regions: selectedRegions,
            status: formData.status || "available",
            vendorRatingAverage: initialData?.vendorRatingAverage,
            vendorRatingCount: initialData?.vendorRatingCount,
            latitude: initialData?.latitude,
            longitude: initialData?.longitude,
            geocodedAt: initialData?.geocodedAt,
            aresCheckedAt: initialData?.aresCheckedAt,
            aresNotFound: initialData?.aresNotFound,
            // Legacy mirror fields for backward compatibility
            name: primaryContact?.name || "-",
            email: primaryContact?.email || "-",
            phone: primaryContact?.phone || "-",
        };
        onSave(contactToSave);
    };

    const webUrl = formData.web?.trim() || "";
    const webHref = webUrl
        ? webUrl.startsWith("http")
            ? webUrl
            : `https://${webUrl}`
        : "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {initialData ? "Upravit kontakt" : "Přidat nový kontakt"}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Firma */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Firma / Dodavatel *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.company || ""}
                                    onChange={e =>
                                        setFormData({ ...formData, company: e.target.value })
                                    }
                                    onKeyDown={e => e.stopPropagation()}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    placeholder="Název firmy"
                                />
                                {companyError && (
                                    <p className="mt-1 text-xs text-red-500">{companyError}</p>
                                )}
                            </div>

                            {/* Specializace */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                    Specializace / Typ *
                                </label>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    {specializations.map(spec => (
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
                                                <span className="material-symbols-outlined text-[14px]">
                                                    close
                                                </span>
                                            </button>
                                        </span>
                                    ))}
                                    {specializations.length === 0 && (
                                        <span className="text-xs text-slate-400 italic">
                                            Přidejte alespoň jednu specializaci
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <AutocompleteInput
                                        value={formData.specializationRaw || ""}
                                        onChange={v =>
                                            setFormData({ ...formData, specializationRaw: v })
                                        }
                                        onCommit={v => handleAddSpecialization(v)}
                                        options={existingSpecializations.filter(
                                            s => !specializations.includes(s),
                                        )}
                                        placeholder="Přidat specializaci (stiskněte Enter)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleAddSpecialization(formData.specializationRaw || "")
                                        }
                                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* IČO */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    IČO
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.ico || ""}
                                        onChange={e =>
                                            setFormData({ ...formData, ico: e.target.value })
                                        }
                                        onBlur={() => {
                                            if (
                                                isBlankRegistrationValue(formData.region) ||
                                                isBlankRegistrationValue(formData.address) ||
                                                isBlankRegistrationValue(formData.city)
                                            ) {
                                                void handleLookupRegistration({
                                                    overwriteExisting: false,
                                                    showNoResultMessage: false,
                                                });
                                            }
                                        }}
                                        onKeyDown={e => e.stopPropagation()}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                        placeholder="IČO firmy"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleLookupRegistration({
                                                overwriteExisting: true,
                                                showNoResultMessage: true,
                                            })
                                        }
                                        disabled={lookupLoading}
                                        title="Dohledat adresu a region dle IČO"
                                        className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                                    >
                                        <span
                                            className={`material-symbols-outlined text-[18px] ${
                                                lookupLoading ? "animate-spin" : ""
                                            }`}
                                        >
                                            {lookupLoading ? "sync" : "travel_explore"}
                                        </span>
                                    </button>
                                </div>
                                {lookupMessage && (
                                    <p
                                        className={`mt-1 text-xs ${
                                            lookupMessage.kind === "error"
                                                ? "text-red-500"
                                                : "text-emerald-500"
                                        }`}
                                    >
                                        {lookupMessage.text}
                                    </p>
                                )}
                            </div>

                            {/* Region */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Region
                                </label>
                                <input
                                    type="text"
                                    value={formData.region || ""}
                                    onChange={e =>
                                        setFormData({ ...formData, region: e.target.value })
                                    }
                                    onKeyDown={e => e.stopPropagation()}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    placeholder="Praha, Brno..."
                                />
                            </div>

                            {/* Adresa */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Adresa
                                </label>
                                <input
                                    type="text"
                                    value={formData.address || ""}
                                    onChange={e =>
                                        setFormData({ ...formData, address: e.target.value })
                                    }
                                    onKeyDown={e => e.stopPropagation()}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    placeholder="Sídlo firmy dle registrace"
                                />
                            </div>

                            {/* Město */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Město
                                </label>
                                <input
                                    type="text"
                                    value={formData.city || ""}
                                    onChange={e =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                    onKeyDown={e => e.stopPropagation()}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    placeholder="Město sídla firmy"
                                />
                            </div>

                            {/* Web */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Web
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={formData.web || ""}
                                        onChange={e =>
                                            setFormData({ ...formData, web: e.target.value })
                                        }
                                        onKeyDown={e => e.stopPropagation()}
                                        className="flex-1 min-w-0 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                        placeholder="https://www.example.cz"
                                    />
                                    {webHref && (
                                        <a
                                            href={webHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium whitespace-nowrap transition-colors"
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (isDesktop) {
                                                    e.preventDefault();
                                                    shellAdapter
                                                        .openExternal(webHref)
                                                        .catch(err =>
                                                            console.warn(
                                                                "Nepodařilo se otevřít odkaz:",
                                                                err,
                                                            ),
                                                        );
                                                }
                                            }}
                                        >
                                            Web
                                            <svg
                                                className="w-3.5 h-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Kraje působnosti */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Kraje působnosti
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {(() => {
                                        const allCodes = CZ_REGIONS.map(r => r.code);
                                        const allSelected = allCodes.every(code =>
                                            selectedRegions.includes(code),
                                        );
                                        return (
                                            <button
                                                type="button"
                                                onClick={toggleAllRegions}
                                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                                                    allSelected
                                                        ? "bg-primary text-white shadow-sm"
                                                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                }`}
                                            >
                                                Celá ČR
                                            </button>
                                        );
                                    })()}
                                    {CZ_REGIONS.map(r => {
                                        const isSelected = selectedRegions.includes(r.code);
                                        return (
                                            <button
                                                key={r.code}
                                                type="button"
                                                onClick={() => toggleRegion(r.code)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                                    isSelected
                                                        ? "bg-primary text-white shadow-sm"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Poznámka
                                </label>
                                <textarea
                                    value={formData.note || ""}
                                    onChange={e =>
                                        setFormData({ ...formData, note: e.target.value })
                                    }
                                    onKeyDown={e => e.stopPropagation()}
                                    rows={3}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-y"
                                    placeholder="Vlastní poznámky k dodavateli..."
                                />
                            </div>

                            {/* Rejstříky */}
                            <PipelineRegistryLinks ico={formData.ico} />

                            {/* Kontaktní osoby */}
                            <PipelineContactPersonsEditor
                                contacts={contactPersons}
                                onChange={contacts =>
                                    setFormData(prev => ({ ...prev, contacts }))
                                }
                                createId={() => crypto.randomUUID()}
                            />

                            {/* Hodnocení + Stav */}
                            <div className="col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                                {initialData && (
                                    <>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            Hodnocení dodavatele
                                        </label>
                                        <div className="flex items-center gap-3 mb-4">
                                            {initialData.vendorRatingAverage !== undefined &&
                                            initialData.vendorRatingAverage !== null ? (
                                                <div
                                                    className="inline-flex items-center gap-2"
                                                    title={
                                                        initialData.vendorRatingCount
                                                            ? `Hodnoceno: ${initialData.vendorRatingCount}×`
                                                            : undefined
                                                    }
                                                >
                                                    <StarRating
                                                        value={initialData.vendorRatingAverage}
                                                        readOnly
                                                        size="sm"
                                                    />
                                                    <span className="text-xs text-slate-500">
                                                        {formatDecimal(
                                                            initialData.vendorRatingAverage,
                                                            {
                                                                minimumFractionDigits: 1,
                                                                maximumFractionDigits: 1,
                                                            },
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    Neohodnoceno
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Stav kontaktu
                                </label>
                                <ThemedNativeSelect
                                    value={formData.status || "available"}
                                    onChange={e =>
                                        setFormData({ ...formData, status: e.target.value })
                                    }
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                >
                                    {safeStatuses.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </ThemedNativeSelect>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {initialData ? "Uložit změny" : "Vytvořit kontakt"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
