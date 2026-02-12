import React from 'react';
import { PublicLayout } from '@/features/public/ui/PublicLayout';

interface AuthLayoutProps {
    children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
    return (
        <PublicLayout>
            {children}
        </PublicLayout>
    );
};
