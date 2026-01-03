import React, { createContext, useContext } from 'react';
import { useUIState, type UseUIStateReturn } from '../hooks/useUIState';

const UIContext = createContext<UseUIStateReturn | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const ui = useUIState();
    return <UIContext.Provider value={ui}>{children}</UIContext.Provider>;
};

export const useUI = (): UseUIStateReturn => {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUI must be used within UIProvider');
    return ctx;
};

