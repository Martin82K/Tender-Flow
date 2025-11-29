import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    updatePreferences: (preferences: any) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const currentUser = authService.getCurrentUser();
            if (currentUser) {
                setUser(currentUser);
            }
            setIsLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const user = await authService.login(email, password);
            setUser(user);
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            // Password is ignored in mock service but would be sent to API
            const user = await authService.register(name, email);
            setUser(user);
        } catch (error) {
            console.error('Registration failed', error);
            throw error;
        }
    };

    const updatePreferences = async (preferences: any) => {
        try {
            const updatedUser = await authService.updateUserPreferences(preferences);
            setUser(updatedUser);
        } catch (error) {
            console.error('Failed to update preferences', error);
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            register,
            updatePreferences,
            logout,
            isAuthenticated: !!user,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
