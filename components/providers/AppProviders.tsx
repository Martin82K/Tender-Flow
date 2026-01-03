import React from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { FeatureProvider } from '../../context/FeatureContext';

interface AppProvidersProps {
    children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <AuthProvider>
            <FeatureProvider>
                {children}
            </FeatureProvider>
        </AuthProvider>
    );
};
