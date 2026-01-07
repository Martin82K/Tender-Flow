/**
 * SubcontractorSelectorModal Component
 * Modal wrapper for SubcontractorSelector with maximize, close, and confirm actions.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React from 'react';
import { SubcontractorSelector } from '../SubcontractorSelector';
import { Subcontractor, StatusConfig } from '../../types';

interface SubcontractorSelectorModalProps {
    isOpen: boolean;
    isMaximized: boolean;
    contacts: Subcontractor[];
    statuses: StatusConfig[];
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    onToggleMaximize: () => void;
    onClose: () => void;
    onConfirm: () => void;
    onAddContact: (name: string) => void;
    onEditContact: (contact: Subcontractor) => void;
}

export const SubcontractorSelectorModal: React.FC<SubcontractorSelectorModalProps> = ({
    isOpen,
    isMaximized,
    contacts,
    statuses,
    selectedIds,
    onSelectionChange,
    onToggleMaximize,
    onClose,
    onConfirm,
    onAddContact,
    onEditContact,
    className, // Just in case, though not in original interface but good practice
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div
                className={`bg-white dark:bg-slate-900 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-200 ${isMaximized
                    ? 'fixed inset-0 rounded-none w-full h-full'
                    : 'rounded-2xl max-w-4xl w-full h-[80vh]'
                    }`}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Vybrat subdodavatele
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleMaximize}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={isMaximized ? 'Obnovit velikost' : 'Zvětšit na celou obrazovku'}
                        >
                            <span className="material-symbols-outlined">
                                {isMaximized ? 'close_fullscreen' : 'fullscreen'}
                            </span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                    <SubcontractorSelector
                        contacts={contacts}
                        statuses={statuses}
                        selectedIds={selectedIds}
                        onSelectionChange={onSelectionChange}
                        onAddContact={onAddContact}
                        onEditContact={onEditContact}
                        className="flex-1 min-h-0"
                    />
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="text-sm text-slate-500">
                        Vybráno:{' '}
                        <span className="font-bold text-slate-900 dark:text-white">
                            {selectedIds.size}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Zrušit
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={selectedIds.size === 0}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Přenést do pipeline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
