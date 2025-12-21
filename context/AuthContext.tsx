import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { isDemoSession, DEMO_USER, endDemoSession, startDemoSession } from '../services/demoData';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    updatePreferences: (preferences: any) => Promise<void>;
    logout: () => void;
    loginAsDemo: () => void;
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
            
            // Priority 1: Check if we are in a demo session
            if (isDemoSession()) {
                console.log('AuthContext: Demo session detected');
                setUser(DEMO_USER);
                setIsLoading(false);
                return;
            }

            try {
                const currentUser = await authService.getCurrentUser();
                console.log('AuthContext: User loaded', currentUser?.email);
                setUser(currentUser);
            } catch (error) {
                console.error('Error loading user:', error);
                setUser(null);
            } finally {
                setIsLoading(false);
                console.log('AuthContext: Loading finished');
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthContext] Auth State Change:', event, session?.user?.email);
            if (event === 'SIGNED_IN') {
                const currentUser = await authService.getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                } else {
                    console.warn('[AuthContext] SIGNED_IN event but no user returned (timeout?). Keeping current session.');
                }
            } else if (event === 'SIGNED_OUT') {
                console.warn('[AuthContext] Received SIGNED_OUT event from Supabase');
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
        try {
            if (isDemoSession()) {
                endDemoSession();
            } else {
                await authService.logout();
            }
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            // Always clear local session even if server request fails
            setUser(null);
        }
    };

    const loginAsDemo = () => {
        startDemoSession();
        setUser(DEMO_USER);
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            register,
            updatePreferences,
            logout,
            loginAsDemo,
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
