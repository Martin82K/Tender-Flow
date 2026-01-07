import React from 'react';
import { useDocHubIntegration } from '../../../../hooks/useDocHubIntegration';
import { type DocHubHierarchyItem } from '../../../../utils/docHub';

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubStructureEditorProps {
    state: DocHubHook['state'];
    actions: DocHubHook['actions'];
    setters: DocHubHook['setters'];
    showModal: (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => void;
}

const moveItem = <T,>(array: T[], index: number, direction: 'up' | 'down'): T[] => {
    const newArray = [...array];
    if (direction === 'up' && index > 0) {
        [newArray[index], newArray[index - 1]] = [newArray[index - 1], newArray[index]];
    } else if (direction === 'down' && index < array.length - 1) {
        [newArray[index], newArray[index + 1]] = [newArray[index + 1], newArray[index]];
    }
    return newArray;
};

// Simple input for inline editing
const InlineInput: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className }) => (
    <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-violet-500 focus:outline-none px-1 py-0.5 text-slate-900 dark:text-white font-medium min-w-[120px] ${className}`}
    />
);

export const DocHubStructureEditor: React.FC<DocHubStructureEditorProps> = ({ state, actions, setters, showModal }) => {
    const {
        isEditingStructure, structureDraft, extraTopLevelDraft, extraSupplierDraft, hierarchyDraft,
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
                                `/${effectiveStructure.pd || ""}`,
                                `/${effectiveStructure.tenders || ""}`,
                                `   /VR-001_Zemeprace`,
                                `      /${effectiveStructure.tendersInquiries || ""}`,
                                `         /Dodavatel_A`,
                                `            /${effectiveStructure.supplierEmail || ""}`,
                                `            /${effectiveStructure.supplierOffer || ""}`,
                                `         /Dodavatel_B`,
                                `   /VR-002_Elektro`,
                                `/${effectiveStructure.contracts || ""}`,
                                `/${effectiveStructure.realization || ""}`,
                                `/${effectiveStructure.archive || ""}`,
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



                    <div className="grid grid-cols-1 gap-4">
                        {/* Tree preview */}
                        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-300">edit</span>
                                Náhled a nastavení struktury
                            </div>

                            <div className="mt-3 text-sm">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                    <span className="font-semibold">Kořen projektu</span>
                                </div>

                                <div className="mt-2 pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                    {/* Flat list with depth-based indentation */}
                                    {hierarchyDraft.map((item, index) => {
                                        const prevItem = index > 0 ? hierarchyDraft[index - 1] : null;
                                        const isBuiltin = ['tenders', 'category', 'tendersInquiries', 'supplier'].includes(item.key);
                                        const isPlaceholder = item.key === 'category' || item.key === 'supplier';

                                        // Helpers for depth changes - use 0 as fallback for missing depth
                                        const itemDepth = item.depth ?? 0;
                                        const prevDepth = prevItem?.depth ?? 0;
                                        // Can indent if there's a previous item and we're not already deeper than it
                                        const canIndent = prevItem != null && itemDepth <= prevDepth;
                                        const canOutdent = itemDepth > 0;

                                        const handleIndent = () => {
                                            if (!canIndent) return;
                                            setters.setHierarchyDraft(hierarchyDraft.map((h, i) =>
                                                i === index ? { ...h, depth: (h.depth ?? 0) + 1 } : h
                                            ));
                                        };

                                        const handleOutdent = () => {
                                            if (!canOutdent) return;
                                            setters.setHierarchyDraft(hierarchyDraft.map((h, i) =>
                                                i === index ? { ...h, depth: Math.max(0, (h.depth ?? 0) - 1) } : h
                                            ));
                                        };

                                        const handleDelete = () => {
                                            setters.setHierarchyDraft(hierarchyDraft.filter((_, i) => i !== index));
                                        };

                                        const handleRename = (newName: string) => {
                                            setters.setHierarchyDraft(hierarchyDraft.map((h, i) =>
                                                i === index ? { ...h, name: newName } : h
                                            ));
                                        };

                                        const handleToggle = () => {
                                            setters.setHierarchyDraft(hierarchyDraft.map((h, i) =>
                                                i === index ? { ...h, enabled: !h.enabled } : h
                                            ));
                                        };

                                        const handleAddSubfolder = () => {
                                            const newFolder: typeof item = {
                                                id: crypto.randomUUID(),
                                                key: 'custom',
                                                name: 'Nova_slozka',
                                                enabled: true,
                                                depth: item.depth + 1
                                            };
                                            const newDraft = [...hierarchyDraft];
                                            newDraft.splice(index + 1, 0, newFolder);
                                            setters.setHierarchyDraft(newDraft);
                                        };

                                        return (
                                            <div key={item.id || `folder-${index}`} style={{ paddingLeft: `${itemDepth * 20}px` }} className="group">
                                                <div className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!item.enabled ? 'opacity-50' : ''}`}>
                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">
                                                        {isPlaceholder ? 'dynamic_feed' : 'folder'}
                                                    </span>

                                                    {isPlaceholder ? (
                                                        <>
                                                            <span className="flex items-center gap-1.5 flex-1">
                                                                <span className="italic text-slate-400 text-xs border-b border-dashed border-slate-300 dark:border-slate-600 px-1">
                                                                    {item.key === 'category' ? '{Název VŘ}' : '{Název dodavatele}'}
                                                                </span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${item.key === 'category'
                                                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                    : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                                                                    }`} title={item.key === 'category' ? 'Automaticky se vytvoří složka pro každé VŘ v projektu' : 'Automaticky se vytvoří složka pro každého poptaného dodavatele'}>
                                                                    {item.key === 'category' ? 'Dynamické' : 'Dynamické'}
                                                                </span>
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-slate-400">/</span>
                                                            <InlineInput
                                                                value={item.name}
                                                                onChange={handleRename}
                                                                className={!item.enabled ? 'line-through text-slate-400' : ''}
                                                            />
                                                        </>
                                                    )}



                                                    {/* Control buttons */}
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-md shadow-sm">
                                                        {/* Move up/down */}
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => setters.setHierarchyDraft(moveItem(hierarchyDraft, index, 'up'))}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                                            title="Posunout výš"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={index === hierarchyDraft.length - 1}
                                                            onClick={() => setters.setHierarchyDraft(moveItem(hierarchyDraft, index, 'down'))}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                                            title="Posunout níž"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                                                        </button>

                                                        <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700/50 mx-0.5" />

                                                        {/* Indent/Outdent */}
                                                        <button
                                                            type="button"
                                                            disabled={!canOutdent}
                                                            onClick={handleOutdent}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                                            title="Zmenšit odsazení"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">format_indent_decrease</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!canIndent}
                                                            onClick={handleIndent}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                                            title="Zvětšit odsazení"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">format_indent_increase</span>
                                                        </button>

                                                        <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700/50 mx-0.5" />

                                                        {/* Add subfolder */}
                                                        <button
                                                            type="button"
                                                            onClick={handleAddSubfolder}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400"
                                                            title="Přidat podsložku"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">create_new_folder</span>
                                                        </button>

                                                        {/* Toggle enabled */}
                                                        <button
                                                            type="button"
                                                            onClick={handleToggle}
                                                            className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${item.enabled ? 'text-emerald-500' : 'text-slate-400'}`}
                                                            title={item.enabled ? "Složka je aktivní" : "Složka je vypnutá"}
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">{item.enabled ? 'visibility' : 'visibility_off'}</span>
                                                        </button>

                                                        {/* Delete (only custom folders) */}
                                                        {!isBuiltin && (
                                                            <button
                                                                type="button"
                                                                onClick={handleDelete}
                                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500"
                                                                title="Smazat složku"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Add folder at root */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newFolder = {
                                                id: crypto.randomUUID(),
                                                key: 'custom',
                                                name: 'Nova_slozka',
                                                enabled: true,
                                                depth: 0
                                            };
                                            setters.setHierarchyDraft([...hierarchyDraft, newFolder]);
                                        }}
                                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors mt-2"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                        Přidat složku do kořene
                                    </button>
                                </div>
                            </div>
                        </div>



                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const preset = { hierarchyDraft };
                                    localStorage.setItem('docHubStructurePreset', JSON.stringify(preset));
                                    showModal({ title: "Předvolba uložena", message: "Struktura byla uložena jako vaše předvolba.", variant: "success" });
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700/50"
                                title="Uložit aktuální strukturu jako předvolbu"
                            >
                                <span className="material-symbols-outlined text-[16px]">save</span>
                                Uložit předvolbu
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const saved = localStorage.getItem('docHubStructurePreset');
                                    if (saved) {
                                        try {
                                            const preset = JSON.parse(saved);
                                            if (preset.hierarchyDraft) {
                                                setters.setHierarchyDraft(preset.hierarchyDraft);
                                                showModal({ title: "Předvolba načtena", message: "Vaše uložená struktura byla aplikována.", variant: "success" });
                                            }
                                        } catch {
                                            showModal({ title: "Chyba", message: "Nepodařilo se načíst předvolbu.", variant: "danger" });
                                        }
                                    } else {
                                        showModal({ title: "Žádná předvolba", message: "Nemáte uloženou žádnou předvolbu.", variant: "info" });
                                    }
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700/50"
                                title="Načíst uloženou předvolbu"
                            >
                                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                Načíst předvolbu
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    // Try reset to User Preset first
                                    const saved = localStorage.getItem('docHubStructurePreset');
                                    let resetTo: DocHubHierarchyItem[] = []; // Default to empty
                                    let message = "Struktura byla vyčištěna (žádná předvolba nenalezena).";

                                    if (saved) {
                                        try {
                                            const preset = JSON.parse(saved);
                                            if (preset.hierarchyDraft && Array.isArray(preset.hierarchyDraft)) {
                                                resetTo = preset.hierarchyDraft;
                                                message = "Struktura byla resetována na vaši uloženou předvolbu.";
                                            }
                                        } catch (e) {
                                            console.warn("Failed to reset to preset", e);
                                        }
                                    }

                                    setters.setStructureDraft({});
                                    setters.setExtraTopLevelDraft([]);
                                    setters.setExtraSupplierDraft([]);
                                    setters.setHierarchyDraft(resetTo);

                                    // Optional: show toast/modal if available
                                    // showModal({ title: "Reset", message, variant: "info" });
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
                </div >
            )}
        </div >
    );
};
