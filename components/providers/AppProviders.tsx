import React from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { FeatureProvider } from '../../context/FeatureContext';
import { UIProvider } from '../../context/UIContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../services/queryClient';

interface AppProvidersProps {
    children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <UIProvider>
                    <FeatureProvider>
                        {children}
                    </FeatureProvider>
                </UIProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
};
