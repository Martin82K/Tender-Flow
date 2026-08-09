import React from 'react';
import { ProjectDetails } from '../../../types';
import { openInExplorer } from '../../../services/fileSystemService';
import { isDesktop } from '../../../services/platformAdapter';
import { isProbablyUrl } from '../../../utils/docHub';

const getSafeExternalUrl = (value: string | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed || !isProbablyUrl(trimmed)) return null;
    return trimmed;
};

interface PriceListsSectionProps {
    project: ProjectDetails;
    isEditing: boolean;
    onEditToggle: (isEditing: boolean) => void;
    linkValue: string;
    onLinkValueChange: (value: string) => void;
    onSave: () => void;
    isDocHubConnected: boolean;
    docHubCenikyLink: string | null;
    showModal: (args: { title: string; message: string; variant?: 'success' | 'danger' | 'info'; copyableText?: string }) => void;
}

export const PriceListsSection: React.FC<PriceListsSectionProps> = ({
    project,
    isEditing,
    onEditToggle,
    linkValue,
    onLinkValueChange,
    onSave,
    isDocHubConnected,
    docHubCenikyLink,
    showModal
}) => {
    const safePriceListUrl = getSafeExternalUrl(project.priceListLink);

    return (
        <div className="space-y-4">
            <div
                data-help-id="documents-price-list-card"
                className={`rounded-lg border p-4 transition-colors ${!!safePriceListUrl ? 'border-primary/20 bg-primary/5' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30'}`}
            >
                <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">payments</span>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Ceníky</h3>
                        {!!safePriceListUrl && (
                            <span
                                data-help-id="documents-price-list-badge"
                                className="ml-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                Nastaveno
                            </span>
                        )}
                    </div>
                    {!isEditing ? (
                        <button
                            onClick={() => onEditToggle(true)}
                            className="flex min-h-10 min-w-10 items-center justify-center rounded-md transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
                            aria-label="Upravit odkaz na ceníky"
                            title="Upravit"
                        >
                            <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={onSave}
                                data-help-id="documents-price-list-save"
                                className="flex min-h-10 min-w-10 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                aria-label="Uložit odkaz na ceníky"
                                title="Uložit"
                            >
                                <span className="material-symbols-outlined text-[20px]">check</span>
                            </button>
                            <button
                                onClick={() => onEditToggle(false)}
                                className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Zrušit úpravu odkazu na ceníky"
                                title="Zrušit"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                    )}
                </div>

                {!isEditing ? (
                    <div>
                        {!!safePriceListUrl ? (
                            <div className="space-y-3">
                                <a
                                    href={safePriceListUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-help-id="documents-price-list-link"
                                    className="group block rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">inventory_2</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {safePriceListUrl}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">open_in_new</span>
                                    </div>
                                </a>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                    Klikněte pro otevření ceníků v novém okně
                                </p>
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <span className="material-symbols-outlined mb-2 block text-4xl text-slate-400">payments</span>
                                <p className="text-slate-400 text-sm">Žádný ceník není nastaven</p>
                                <p className="text-slate-500 text-xs mt-1">Klikněte na ikonu úprav pro přidání odkazu</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <input
                            type="url"
                            value={linkValue}
                            onChange={(e) => onLinkValueChange(e.target.value)}
                            placeholder="https://example.com/price-lists"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                        />
                        <p className="text-xs text-slate-500">
                            Zadejte URL odkaz na ceníky (např. Google Drive, Excel v cloudu, SharePoint)
                        </p>
                    </div>
                )}
            </div>

            {isDocHubConnected && docHubCenikyLink && (
                <div
                    data-help-id="documents-dochub-quick-link"
                    className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">folder</span>
                            <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">DocHub /Ceníky</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Rychlý odkaz na složku ceníků v DocHubu</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            data-help-id="documents-dochub-open"
                            onClick={async () => {
                                const value = docHubCenikyLink || "";
                                if (isProbablyUrl(value)) {
                                    window.open(value, "_blank", "noopener,noreferrer");
                                    return;
                                }
                                if (isDesktop) {
                                    const result = await openInExplorer(value);
                                    if (result.success) return;
                                }
                                try {
                                    await navigator.clipboard.writeText(value);
                                    showModal({ title: "Zkopírováno", message: value, variant: "success" });
                                } catch {
                                    showModal({
                                        title: "Zkopírujte cestu",
                                        message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
                                        variant: "info",
                                        copyableText: value,
                                    });
                                }
                            }}
                            className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                            {isProbablyUrl(docHubCenikyLink || "") ? "Otevřít" : "Zkopírovat"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
