import React from 'react';
import { PublicLayout } from '../public/PublicLayout';

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
