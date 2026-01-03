import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

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

    return (
        <Modal isOpen={isOpen} onClose={onCancel || (() => { })} size="sm">
            <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 ${getIconColor()}`}>
                    <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">{message}</p>
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
