import React from 'react';
import { useDocHubIntegration } from '../../../../hooks/useDocHubIntegration';
import { resolveDocHubStructureV1 } from '../../../../utils/docHub';

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubStructureEditorProps {
    state: DocHubHook['state'];
    actions: DocHubHook['actions'];
    setters: DocHubHook['setters'];
    showModal: (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => void;
}

export const DocHubStructureEditor: React.FC<DocHubStructureEditorProps> = ({ state, actions, setters, showModal }) => {
    const {
        isEditingStructure, structureDraft, extraTopLevelDraft, extraSupplierDraft,
        isAutoCreating, isConnected, autoCreateProgress
    } = state;

    // Use structureDraft as effective structure since hook syncs it with project
    const effectiveStructure = structureDraft;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-300">account_tree</span>
                    Struktura (v1)
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setters.setIsEditingStructure(!isEditingStructure)}
                        disabled={isAutoCreating}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isAutoCreating
                            ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                            : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                            }`}
                        title={isAutoCreating ? "Nelze měnit během auto‑vytváření." : undefined}
                    >
                        {isEditingStructure ? "Zavřít úpravy" : "Upravit strukturu"}
                    </button>
                    <button
                        type="button"
                        onClick={() => actions.runAutoCreate()}
                        disabled={isAutoCreating || !isConnected}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${isAutoCreating || !isConnected
                            ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                            : "bg-primary/15 hover:bg-primary/20 text-primary border-primary/30"
                            }`}
                        title={!isConnected ? "Nejdřív připojte DocHub a nastavte hlavní složku projektu." : "Synchronizuje DocHub strukturu pro projekt (ručně)."}
                    >
                        {isAutoCreating
                            ? `Auto‑vytváření… ${autoCreateProgress}%`
                            : "Synchronizovat"}
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            const structure = [
                                `/${effectiveStructure.pd}`,
                                `/${effectiveStructure.tenders}`,
                                `   /VR-001_Zemeprace`,
                                `      /${effectiveStructure.tendersInquiries}`,
                                `         /Dodavatel_A`,
                                `            /${effectiveStructure.supplierEmail}`,
                                `            /${effectiveStructure.supplierOffer}`,
                                `         /Dodavatel_B`,
                                `   /VR-002_Elektro`,
                                `/${effectiveStructure.contracts}`,
                                `/${effectiveStructure.realization}`,
                                `/${effectiveStructure.archive}`,
                            ].join('\n');
                            try {
                                await navigator.clipboard.writeText(structure);
                                showModal({ title: "Zkopírováno", message: "Struktura DocHub zkopírována do schránky.", variant: "success" });
                            } catch {
                                window.prompt('Zkopírujte strukturu:', structure);
                            }
                        }}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                    >
                        Zkopírovat
                    </button>
                </div>
            </div>

            {isEditingStructure && (
                <div className="bg-slate-100 dark:bg-slate-950/30 border border-slate-300 dark:border-slate-700/50 rounded-xl p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Tree preview */}
                        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-300">account_tree</span>
                                Náhled struktury
                            </div>

                            <div className="mt-3 text-sm">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                    <span className="font-semibold">Kořen projektu</span>
                                </div>

                                <div className="mt-2 pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                        <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.pd}</span>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                            <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.tenders}</span>
                                        </div>
                                        <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_right</span>
                                                <span className="italic">VR-001_Nazev_vyberoveho_rizeni</span>
                                            </div>
                                            <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                    <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.tendersInquiries}</span>
                                                </div>
                                                <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_right</span>
                                                        <span className="italic">Dodavatel_X</span>
                                                    </div>
                                                    <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                            <span className="text-slate-900 dark:text-white">/{structureDraft.supplierEmail}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                            <span className="text-slate-900 dark:text-white">/{structureDraft.supplierOffer}</span>
                                                        </div>
                                                        {extraSupplierDraft.map((name, idx) => (
                                                            <div key={`${name}-${idx}`} className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                <span className="text-slate-900 dark:text-white">/{name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                        <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.contracts}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                        <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.realization}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                        <span className="font-medium text-slate-900 dark:text-white">/{structureDraft.archive}</span>
                                    </div>

                                    {extraTopLevelDraft.length > 0 && (
                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                                Další složky
                                            </div>
                                            <div className="space-y-1">
                                                {extraTopLevelDraft.map((name, idx) => (
                                                    <div key={`${name}-${idx}`} className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                        <span className="text-slate-900 dark:text-white">/{name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                                    Kořen projektu (hlavní složky)
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {([
                                        ["pd", "PD (1. úroveň)"],
                                        ["tenders", "Výběrová řízení (1. úroveň)"],
                                        ["contracts", "Smlouvy (1. úroveň)"],
                                        ["realization", "Realizace (1. úroveň)"],
                                        ["archive", "Archiv (1. úroveň)"],
                                    ] as const).map(([key, label]) => (
                                        <div key={key} className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {label}
                                            </label>
                                            <input
                                                type="text"
                                                value={structureDraft[key]}
                                                onChange={(e) =>
                                                    setters.setStructureDraft((prev: any) => ({ ...prev, [key]: e.target.value }))
                                                }
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                Další složky v kořeni (volitelné)
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Tyto složky jsou jen navíc; aplikace je zatím nepoužívá v ostatních modulech.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setters.setExtraTopLevelDraft((prev) => [...prev, ""])}
                                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                        >
                                            + Přidat
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {extraTopLevelDraft.length === 0 ? (
                                            <div className="text-xs text-slate-500 italic">
                                                Zatím žádné další složky.
                                            </div>
                                        ) : (
                                            extraTopLevelDraft.map((name, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) =>
                                                            setters.setExtraTopLevelDraft((prev) =>
                                                                prev.map((v, i) => (i === idx ? e.target.value : v))
                                                            )
                                                        }
                                                        placeholder="Název složky (např. 05_Fotky)"
                                                        className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setters.setExtraTopLevelDraft((prev) => prev.filter((_, i) => i !== idx))}
                                                        className="p-2 rounded-lg border border-slate-300 dark:border-slate-700/50 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                                                        title="Odebrat"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                                    Výběrová řízení (podsložky)
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {([
                                        ["tendersInquiries", "Poptávky (uvnitř VŘ)"],
                                        ["supplierEmail", "Email (uvnitř Dodavatele)"],
                                        ["supplierOffer", "Cenová nabídka (uvnitř Dodavatele)"],
                                    ] as const).map(([key, label]) => (
                                        <div key={key} className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {label}
                                            </label>
                                            <input
                                                type="text"
                                                value={structureDraft[key]}
                                                onChange={(e) =>
                                                    setters.setStructureDraft((prev: any) => ({ ...prev, [key]: e.target.value }))
                                                }
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                Další podsložky u dodavatele (volitelné)
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Přidá další podsložky vedle Email / Cenová nabídka.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setters.setExtraSupplierDraft((prev) => [...prev, ""])}
                                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                        >
                                            + Přidat
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {extraSupplierDraft.length === 0 ? (
                                            <div className="text-xs text-slate-500 italic">
                                                Zatím žádné další podsložky.
                                            </div>
                                        ) : (
                                            extraSupplierDraft.map((name, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) =>
                                                            setters.setExtraSupplierDraft((prev) =>
                                                                prev.map((v, i) => (i === idx ? e.target.value : v))
                                                            )
                                                        }
                                                        placeholder="Název podsložky (např. Smlouvy, Fotky...)"
                                                        className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setters.setExtraSupplierDraft((prev) => prev.filter((_, i) => i !== idx))}
                                                        className="p-2 rounded-lg border border-slate-300 dark:border-slate-700/50 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                                                        title="Odebrat"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                        <p className="text-xs text-slate-500">
                            Doporučení: měňte jen názvy složek; struktura (vazby) v aplikaci zůstává stejná.
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setters.setStructureDraft(resolveDocHubStructureV1(null));
                                    setters.setExtraTopLevelDraft([]);
                                    setters.setExtraSupplierDraft([]);
                                }}
                                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={actions.saveStructure}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                Uložit strukturu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
