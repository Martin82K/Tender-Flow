import React, { useState } from 'react';
import { ProjectDetails } from '../../../types';
import { isProbablyUrl } from '../../../utils/docHub';

interface DocsLinkSectionProps {
    project: ProjectDetails;
    hasDocsLink: boolean;
    isEditing: boolean;
    onEditToggle: (isEditing: boolean) => void;
    linkValue: string;
    onLinkValueChange: (value: string) => void;
    onSave: () => void;
    isDocHubConnected: boolean;
    docHubPdLink: string | null;
    docHubStructure: { pd: string };
    showModal: (args: { title: string; message: string; variant?: 'success' | 'danger' | 'info' }) => void;
}

export const DocsLinkSection: React.FC<DocsLinkSectionProps> = ({
    project,
    hasDocsLink,
    isEditing,
    onEditToggle,
    linkValue,
    onLinkValueChange,
    onSave,
    isDocHubConnected,
    docHubPdLink,
    docHubStructure,
    showModal
}) => {
    return (
        <div className="space-y-4">
            <div className={`rounded-xl p-6 border transition-colors ${hasDocsLink ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/40'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">link</span>
                        <h3 className="font-semibold text-slate-900 dark:text-white">PD (projektová dokumentace)</h3>
                        {hasDocsLink && (
                            <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
                                Nastaveno
                            </span>
                        )}
                    </div>
                    {!isEditing ? (
                        <button
                            onClick={() => onEditToggle(true)}
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
                        >
                            <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={onSave}
                                className="text-green-500 hover:text-green-600"
                            >
                                <span className="material-symbols-outlined text-[20px]">check</span>
                            </button>
                            <button
                                onClick={() => onEditToggle(false)}
                                className="text-red-500 hover:text-red-600"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                    )}
                </div>

                {!isEditing ? (
                    <div>
                        {hasDocsLink ? (
                            <div className="space-y-3">
                                <a
                                    href={project.documentationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30 hover:shadow-md dark:hover:bg-slate-700/50 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">description</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {project.documentationLink}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">open_in_new</span>
                                    </div>
                                </a>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                    Klikněte pro otevření v novém okně
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">link_off</span>
                                <p className="text-slate-400 text-sm">Žádný odkaz není nastaven</p>
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
                            placeholder="https://example.com/project-docs"
                            className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                        />
                        <p className="text-xs text-slate-500">
                            Zadejte URL odkaz na sdílenou složku (např. Google Drive, Dropbox, SharePoint)
                        </p>
                    </div>
                )}
            </div>

            {isDocHubConnected && docHubPdLink && (
                <div className="mt-4 rounded-xl p-4 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-violet-300">folder</span>
                            <div>
                                <div className="text-sm font-semibold text-violet-900 dark:text-white">DocHub /{docHubStructure.pd}</div>
                                <div className="text-xs text-violet-700/70 dark:text-slate-400">Rychlý odkaz na PD složku v DocHubu</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const value = docHubPdLink || "";
                                if (isProbablyUrl(value)) {
                                    window.open(value, "_blank", "noopener,noreferrer");
                                    return;
                                }
                                try {
                                    await navigator.clipboard.writeText(value);
                                    showModal({ title: "Zkopírováno", message: value, variant: "success" });
                                } catch {
                                    window.prompt("Zkopírujte cestu:", value);
                                }
                            }}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            {isProbablyUrl(docHubPdLink || "") ? "Otevřít" : "Zkopírovat"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
