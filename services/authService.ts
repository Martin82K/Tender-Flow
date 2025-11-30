import { supabase } from './supabase';
import { User } from '../types';

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) throw new Error('No user returned from login');

        // Use getCurrentUser to get complete user data including saved preferences
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Failed to load user data after login');
        
        return user;
    },

    register: async (name: string, email: string, password: string): Promise<User> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                },
            },
        });

        if (error) throw error;
        if (!data.user) throw new Error('No user returned from registration');

        // Profile is created by trigger automatically
        // Use getCurrentUser to get complete user data
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Failed to load user data after registration');
        
        return user;
    },

    logout: async (): Promise<void> => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    getCurrentUser: async (): Promise<User | null> => {
        console.log('[authService] getCurrentUser: Starting...');
        let session = null;
        try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Session fetch timeout')), 2000)
            );
            
            const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
            session = data.session;
            console.log('[authService] getCurrentUser: Session loaded', session?.user?.id);
        } catch (e) {
            console.warn('[authService] getCurrentUser: Could not fetch session', e);
            return null;
        }

        if (!session?.user) {
            console.warn('[authService] getCurrentUser: No session user');
            return null;
        }

        // Fetch profile for role
        let profile = null;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();
            profile = data;
            console.log('[authService] getCurrentUser: Profile loaded', { is_admin: profile?.is_admin });
        } catch (e) {
            console.warn('[authService] getCurrentUser: Could not fetch profile', e);
        }

        // Fetch settings
        let settings = null;
        try {
            console.log('[authService] getCurrentUser: Fetching user_settings for user_id:', session.user.id);
            const { data, error } = await supabase
                .from('user_settings')
                .select('preferences')
                .eq('user_id', session.user.id)
                .single();
            
            if (error) {
                // It's normal to not have settings yet, don't warn for PGRST116 (no rows)
                if (error.code !== 'PGRST116') {
                    console.error('[authService] getCurrentUser: Error fetching user settings:', error);
                } else {
                    console.log('[authService] getCurrentUser: No user_settings row found (will use defaults)');
                }
            } else {
                settings = data;
                console.log('[authService] getCurrentUser: Loaded user settings:', settings);
            }
        } catch (e) {
            console.error('[authService] getCurrentUser: Exception fetching settings', e);
        }

        const finalPreferences = settings?.preferences || {
            darkMode: false,
            primaryColor: '#607AFB',
            backgroundColor: '#f5f6f8'
        };

        console.log('[authService] getCurrentUser: Final preferences:', finalPreferences);

        return {
            id: session.user.id,
            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: profile?.is_admin ? 'admin' : 'user',
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email || 'U')}&background=random`,
            preferences: finalPreferences
        };
    },

    updateUserPreferences: async (preferences: any): Promise<User> => {
        console.log('[authService] updateUserPreferences: Starting with preferences:', preferences);
        const user = await authService.getCurrentUser();
        if (!user) {
            console.error('[authService] updateUserPreferences: No user logged in');
            throw new Error('No user logged in');
        }
        
        const newPreferences = {
            ...user.preferences,
            ...preferences
        };

        console.log('[authService] updateUserPreferences: Merged preferences:', newPreferences);
        console.log('[authService] updateUserPreferences: Upserting to user_settings for user_id:', user.id);

        // Upsert to user_settings
        const { error, data } = await supabase
            .from('user_settings')
            .upsert({ 
                user_id: user.id, 
                preferences: newPreferences,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();

        if (error) {
            console.error('[authService] updateUserPreferences: Failed to save preferences to DB:', error);
            console.error('[authService] updateUserPreferences: Error details:', JSON.stringify(error, null, 2));
        } else {
            console.log('[authService] updateUserPreferences: Preferences saved successfully');
            console.log('[authService] updateUserPreferences: Upsert result:', data);
        }
        
        return {
            ...user,
            preferences: newPreferences
        };
    }
};
