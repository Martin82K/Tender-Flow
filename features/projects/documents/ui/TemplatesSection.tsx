import React from 'react';
import type { ProjectDetails } from '@/types';

interface TemplatesSectionProps {
    project: ProjectDetails;
    templateName: string | null;
    materialTemplateName: string | null;
    losersTemplateName: string | null;
    openTemplateManager: (opts: { target: { kind: 'inquiry' } | { kind: 'materialInquiry' } | { kind: 'losers' }; initialLink: string }) => void;
}

export const TemplatesSection: React.FC<TemplatesSectionProps> = ({
    project,
    templateName,
    materialTemplateName,
    losersTemplateName,
    openTemplateManager
}) => {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">Šablony</h3>
                <p className="text-xs text-slate-500 mt-1">Vaše osobní nastavení pro tuto stavbu. Volby ostatních uživatelů se tím nezmění.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-semibold">Typ</th>
                            <th className="px-4 py-2.5 text-left font-semibold">Aktivní šablona</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Akce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        <tr data-help-id="templates-inquiry" className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400 mt-0.5">mail</span>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Šablona poptávek</div>
                                        <div className="text-xs text-slate-500">Použije se pro akci „Generovat poptávku“.</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                {project.inquiryLetterLink ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                                            {project.inquiryLetterLink.startsWith('template:') ? 'wysiwyg' : 'link'}
                                        </span>
                                        <span className="text-slate-900 dark:text-white font-medium truncate">
                                            {project.inquiryLetterLink.startsWith('template:')
                                                ? (templateName || 'Načítání...')
                                                : (project.inquiryLetterLink.startsWith('http') ? 'Externí odkaz / Soubor' : project.inquiryLetterLink)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-500">Nenastaveno</span>
                                )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                <button
                                    onClick={() => openTemplateManager({ target: { kind: 'inquiry' }, initialLink: project.inquiryLetterLink || '' })}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <span className="material-symbols-outlined text-[18px]">{project.inquiryLetterLink ? 'edit' : 'add_circle'}</span>
                                    {project.inquiryLetterLink ? 'Změnit' : 'Vybrat'}
                                </button>
                            </td>
                        </tr>

                        <tr data-help-id="templates-material" className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400 mt-0.5">inventory_2</span>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Šablona materiálové poptávky</div>
                                        <div className="text-xs text-slate-500">Použije se pro akci „Materiálová poptávka“.</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                {project.materialInquiryTemplateLink ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                                            {project.materialInquiryTemplateLink.startsWith('template:') ? 'wysiwyg' : 'link'}
                                        </span>
                                        <span className="text-slate-900 dark:text-white font-medium truncate">
                                            {project.materialInquiryTemplateLink.startsWith('template:')
                                                ? (materialTemplateName || 'Načítání...')
                                                : (project.materialInquiryTemplateLink.startsWith('http') ? 'Externí odkaz / Soubor' : project.materialInquiryTemplateLink)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-500">Nenastaveno</span>
                                )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                <button
                                    onClick={() => openTemplateManager({ target: { kind: 'materialInquiry' }, initialLink: project.materialInquiryTemplateLink || '' })}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <span className="material-symbols-outlined text-[18px]">{project.materialInquiryTemplateLink ? 'edit' : 'add_circle'}</span>
                                    {project.materialInquiryTemplateLink ? 'Změnit' : 'Vybrat'}
                                </button>
                            </td>
                        </tr>

                        <tr data-help-id="templates-losers" className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400 mt-0.5">mark_email_unread</span>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Šablona emailu nevybraným</div>
                                        <div className="text-xs text-slate-500">Vloží se do emailu při „Email nevybraným“.</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                {project.losersEmailTemplateLink ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                                            {project.losersEmailTemplateLink.startsWith('template:') ? 'wysiwyg' : 'link'}
                                        </span>
                                        <span className="text-slate-900 dark:text-white font-medium truncate">
                                            {project.losersEmailTemplateLink.startsWith('template:')
                                                ? (losersTemplateName || 'Načítání...')
                                                : (project.losersEmailTemplateLink.startsWith('http') ? 'Externí odkaz / Soubor' : project.losersEmailTemplateLink)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-500">Nenastaveno (použije se výchozí text)</span>
                                )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                <button
                                    onClick={() => openTemplateManager({ target: { kind: 'losers' }, initialLink: project.losersEmailTemplateLink || '' })}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <span className="material-symbols-outlined text-[18px]">{project.losersEmailTemplateLink ? 'edit' : 'add_circle'}</span>
                                    {project.losersEmailTemplateLink ? 'Změnit' : 'Vybrat'}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
