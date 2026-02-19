import React, { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    projectName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    isOpen,
    projectName,
    onConfirm,
    onCancel
}) => {
    const [inputValue, setInputValue] = useState('');

    // Reset input when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
        }
    }, [isOpen]);

    const isMatch = inputValue.toLowerCase() === 'smazat';

    return (
        <Modal isOpen={isOpen} onClose={onCancel} size="sm">
            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    Smazat stavbu?
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-2">
                    Chystáte se smazat stavbu:
                </p>
                <p className="text-red-500 font-bold text-base mb-4">
                    {projectName}
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                    Pro potvrzení napište <span className="font-bold text-red-500">smazat</span>
                </p>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="smazat"
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-red-500/50 focus:outline-none text-center"
                    autoFocus
                />
            </div>

            <div className="mt-6 flex gap-3">
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={onCancel}
                >
                    Zrušit
                </Button>
                <Button
                    variant="danger"
                    className="flex-1"
                    onClick={onConfirm}
                    disabled={!isMatch}
                >
                    Smazat
                </Button>
            </div>
        </Modal>
    );
};
