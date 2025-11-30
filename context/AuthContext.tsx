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

import { supabase } from '../services/supabase';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check active session
        const initAuth = async () => {
            console.log('AuthContext: Initializing...');
            let timeoutId: NodeJS.Timeout;

            try {
                // Create a promise that rejects after 5 seconds
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('Auth check timed out')), 5000);
                });

                // Race the auth check against the timeout
                const currentUser = await Promise.race([
                    authService.getCurrentUser(),
                    timeoutPromise
                ]) as User | null;

                console.log('AuthContext: User loaded', currentUser?.email);
                setUser(currentUser);
            } catch (error) {
                console.error('Error loading user:', error);
                // If auth fails/timeouts, we assume not logged in, but we stop loading
                setUser(null);
            } finally {
                if (timeoutId!) clearTimeout(timeoutId);
                setIsLoading(false);
                console.log('AuthContext: Loading finished');
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
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
            const user = await authService.register(name, email, password);
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

    const logout = async () => {
        await authService.logout();
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
