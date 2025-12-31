import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
	    const authEventRef = useRef(false);

	    useEffect(() => {
	        console.log('AuthContext: Initializing...');

            // Priority 1: Demo session
            if (isDemoSession()) {
                console.log('AuthContext: Demo session detected');
                setUser(DEMO_USER);
                setIsLoading(false);
                return;
            }

	        // Listen for auth changes first (so INITIAL_SESSION can hydrate even if getCurrentUser hangs)
	        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
	            console.log('[AuthContext] Auth State Change:', event, session?.user?.email);
	            authEventRef.current = true;
	            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
	                if (session) {
	                    // Use session directly from callback - no extra API call needed!
	                    const currentUser = await authService.getUserFromSession(session);
                    if (currentUser) {
                        setUser(currentUser);
                        setIsLoading(false);
                    } else {
                        console.warn('[AuthContext] Event but could not build user from session');
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                console.warn('[AuthContext] Received SIGNED_OUT event from Supabase');
                setUser(null);
            }
        });

	        // Best-effort active session load, but never block UI indefinitely.
	        const initTimeoutMs = 3500;
	        let finished = false;
	        const finish = () => {
	            if (finished) return;
	            finished = true;
	            setIsLoading(false);
	            console.log('AuthContext: Loading finished');
	        };
	        const timer = window.setTimeout(() => {
	            console.warn(`[AuthContext] initAuth timed out (${initTimeoutMs}ms)`);
	            finish();
	        }, initTimeoutMs);

	        (async () => {
	            try {
	                const currentUser = await authService.getCurrentUser();
	                console.log('AuthContext: User loaded', currentUser?.email);
	                if (!authEventRef.current || currentUser) {
	                    setUser(currentUser);
	                }
	            } catch (error) {
	                console.error('Error loading user:', error);
	                if (!authEventRef.current) setUser(null);
	            } finally {
	                window.clearTimeout(timer);
	                finish();
	            }
	        })();

        return () => {
            // Cleanup
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const timeoutMs = 4000;
            const user = await Promise.race([
                authService.login(email, password),
                new Promise<User>((resolve) =>
                    setTimeout(() => {
                        console.warn(`[AuthContext] login timed out (${timeoutMs}ms) - proceeding; auth event should hydrate`);
                        resolve({
                            id: 'pending',
                            name: 'User',
                            email,
                            role: 'user',
                            preferences: { theme: 'system', primaryColor: '#607AFB', backgroundColor: '#f5f6f8' }
                        } as User);
                    }, timeoutMs)
                ),
            ]);
            // If we got a real user (or fallback), allow navigation; auth events will refine user data.
            if (user?.id !== 'pending') setUser(user);
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
