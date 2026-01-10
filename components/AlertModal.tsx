import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    variant?: 'success' | 'error' | 'info';
    buttonLabel?: string;
    copyableText?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    title,
    message,
    onClose,
    variant = 'info',
    buttonLabel = 'OK',
    copyableText
}) => {
    const handleCopy = () => {
        if (copyableText) {
            navigator.clipboard.writeText(copyableText);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <div className="flex justify-end w-full">
                    <Button onClick={onClose} variant={variant === 'error' ? 'danger' : 'primary'}>
                        {buttonLabel}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center gap-4 text-center">
                {variant === 'success' && (
                    <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-3xl">check_circle</span>
                    </div>
                )}
                {variant === 'error' && (
                    <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">error</span>
                    </div>
                )}
                {variant === 'info' && (
                    <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-3xl">info</span>
                    </div>
                )}
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line text-lg">
                    {message}
                </p>

                {copyableText && (
                    <div className="flex items-center gap-2 w-full max-w-sm mt-2">
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
        </Modal>
    );
};
