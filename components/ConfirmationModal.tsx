import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'danger' | 'info' | 'success';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Zrušit',
    onConfirm,
    onCancel,
    variant = 'danger'
}) => {
    if (!isOpen) return null;

    const getPrimaryButtonClass = () => {
        switch (variant) {
            case 'danger':
                return 'bg-red-600 hover:bg-red-500 shadow-red-900/20';
            case 'success':
                return 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20';
            default:
                return 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20';
        }
    };

    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return 'warning';
            case 'success':
                return 'check_circle';
            default:
                return 'info';
        }
    };

    const getIconColor = () => {
        switch (variant) {
            case 'danger':
                return 'text-red-500';
            case 'success':
                return 'text-emerald-500';
            default:
                return 'text-blue-500';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 ${getIconColor()}`}>
                        <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">{message}</p>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold shadow-lg transition-all ${getPrimaryButtonClass()}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
