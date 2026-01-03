/**
 * UI State Hook
 * Handles common UI state like modals and sidebar visibility.
 */

import { useState, useEffect, useCallback } from "react";

// Modal types
export interface UiModalState {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export interface ShowModalOptions {
    title: string;
    message: string;
    variant?: 'danger' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export interface UseUIStateReturn {
    // Modal
    uiModal: UiModalState;
    showUiModal: (opts: ShowModalOptions) => void;
    showAlert: (opts: Omit<ShowModalOptions, 'cancelLabel' | 'onCancel'>) => void;
    showConfirm: (opts: ShowModalOptions) => Promise<boolean>;
    closeUiModal: () => void;

    // Sidebar
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

const MOBILE_BREAKPOINT = 768;

/**
 * Custom hook for common UI state management
 */
export const useUIState = (): UseUIStateReturn => {
    // Modal state
    const [uiModal, setUiModal] = useState<UiModalState>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info',
        confirmLabel: 'OK',
    });

    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Responsive sidebar management
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < MOBILE_BREAKPOINT) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const closeUiModal = useCallback(() => {
        setUiModal(prev => ({
            ...prev,
            isOpen: false,
            cancelLabel: undefined,
            onConfirm: undefined,
            onCancel: undefined,
        }));
    }, []);

    // Modal functions
    const showUiModal = useCallback((opts: ShowModalOptions) => {
        const shouldShowCancel = Boolean(opts.cancelLabel || opts.onCancel);
        setUiModal({
            isOpen: true,
            title: opts.title,
            message: opts.message,
            variant: opts.variant ?? 'info',
            confirmLabel: opts.confirmLabel ?? 'OK',
            cancelLabel: shouldShowCancel ? (opts.cancelLabel ?? 'Zrušit') : undefined,
            onConfirm: () => {
                closeUiModal();
                opts.onConfirm?.();
            },
            onCancel: shouldShowCancel
                ? () => {
                    closeUiModal();
                    opts.onCancel?.();
                }
                : undefined,
        });
    }, [closeUiModal]);

    const showAlert = useCallback((opts: Omit<ShowModalOptions, 'cancelLabel' | 'onCancel'>) => {
        showUiModal({ ...opts, cancelLabel: undefined, onCancel: undefined });
    }, [showUiModal]);

    const showConfirm = useCallback((opts: ShowModalOptions) => {
        return new Promise<boolean>((resolve) => {
            showUiModal({
                ...opts,
                cancelLabel: opts.cancelLabel ?? 'Zrušit',
                confirmLabel: opts.confirmLabel ?? 'OK',
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            });
        });
    }, [showUiModal]);

    // Sidebar functions
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    return {
        uiModal,
        showUiModal,
        showAlert,
        showConfirm,
        closeUiModal,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
    };
};
