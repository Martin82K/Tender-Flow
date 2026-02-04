import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    messageNode?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'danger' | 'info' | 'success';
    copyableText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    messageNode,
    confirmLabel = 'OK',
    cancelLabel = 'Zrušit',
    onConfirm,
    onCancel,
    variant = 'danger',
    copyableText
}) => {

    const getIcon = () => {
        switch (variant) {
            case 'danger': return 'warning';
            case 'success': return 'check_circle';
            default: return 'info';
        }
    };

    const getIconColor = () => {
        switch (variant) {
            case 'danger': return 'text-red-500';
            case 'success': return 'text-emerald-500';
            default: return 'text-blue-500';
        }
    };

    const getButtonVariant = () => {
        switch (variant) {
            case 'danger': return 'danger';
            case 'success': return 'success';
            default: return 'primary';
        }
    };

    const handleCopy = () => {
        if (copyableText) {
            navigator.clipboard.writeText(copyableText);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onCancel || (() => { })} size="sm">
            <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 ${getIconColor()}`}>
                    <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                {messageNode ? (
                    <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                        {messageNode}
                    </div>
                ) : (
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">{message}</p>
                )}

                {copyableText && (
                    <div className="flex items-center gap-2 w-full max-w-sm mt-3">
                        <input
                            type="text"
                            readOnly
                            value={copyableText}
                            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg select-all"
                            onClick={(e) => e.currentTarget.select()}
                        />
                        <button
                            onClick={handleCopy}
                            className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Zkopírovat"
                        >
                            <span className="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-8 flex gap-3">
                {onCancel && (
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                )}
                <Button
                    variant={getButtonVariant()}
                    className="flex-1"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    );
};
