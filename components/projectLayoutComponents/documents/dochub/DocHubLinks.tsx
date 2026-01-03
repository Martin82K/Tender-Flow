import React from 'react';
import { useDocHubIntegration } from '../../../../hooks/useDocHubIntegration';
import { isProbablyUrl } from '../../../../utils/docHub';

type DocHubHook = ReturnType<typeof useDocHubIntegration>;

interface DocHubLinksProps {
    state: DocHubHook['state'];
    showModal: (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => void;
}

export const DocHubLinks: React.FC<DocHubLinksProps> = ({ state, showModal }) => {
    const { docHubProjectLinks, structureDraft } = state;

    if (!docHubProjectLinks) return null;

    // Use structureDraft as effective structure (it is initialized from project)
    const effectiveStructure = structureDraft;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
                { label: `/${effectiveStructure.pd}`, href: docHubProjectLinks.pd || "" },
                { label: `/${effectiveStructure.tenders}`, href: docHubProjectLinks.tenders || "" },
                { label: `/${effectiveStructure.contracts}`, href: docHubProjectLinks.contracts || "" },
                { label: `/${effectiveStructure.realization}`, href: docHubProjectLinks.realization || "" },
                { label: `/${effectiveStructure.archive}`, href: docHubProjectLinks.archive || "" },
            ].map((item) => (
                <a
                    key={item.label}
                    href={isProbablyUrl(item.href) ? item.href : undefined}
                    target={isProbablyUrl(item.href) ? "_blank" : undefined}
                    rel={isProbablyUrl(item.href) ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                        if (isProbablyUrl(item.href)) return;
                        e.preventDefault();
                        navigator.clipboard
                            .writeText(item.href)
                            .then(() => showModal({ title: "Zkopírováno", message: item.href, variant: "success" }))
                            .catch(() => window.prompt('Zkopírujte cestu:', item.href));
                    }}
                    className="block p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all shadow-sm"
                    title={isProbablyUrl(item.href) ? "Otevřít" : "Zkopírovat cestu"}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-violet-600 dark:text-violet-400">folder</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {item.label}
                            </span>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">content_copy</span>
                    </div>
                </a>
            ))}
        </div>
    );
};
