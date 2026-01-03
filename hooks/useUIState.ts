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
}

export interface ShowModalOptions {
    title: string;
    message: string;
    variant?: 'danger' | 'info' | 'success';
    confirmLabel?: string;
}

export interface UseUIStateReturn {
    // Modal
    uiModal: UiModalState;
    showUiModal: (opts: ShowModalOptions) => void;
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
        confirmLabel: 'Zavřít',
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

    // Modal functions
    const showUiModal = useCallback((opts: ShowModalOptions) => {
        setUiModal({
            isOpen: true,
            title: opts.title,
            message: opts.message,
            variant: opts.variant ?? 'info',
            confirmLabel: opts.confirmLabel ?? 'Zavřít',
        });
    }, []);

    const closeUiModal = useCallback(() => {
        setUiModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Sidebar functions
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    return {
        uiModal,
        showUiModal,
        closeUiModal,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
    };
};
