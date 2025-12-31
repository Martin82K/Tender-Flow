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
        // Check registration settings before allowing signup
        const canRegister = await authService.checkRegistrationAllowed(email);
        if (!canRegister.allowed) {
            throw new Error(canRegister.reason || 'Registrace není povolena pro tento email.');
        }

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

    checkRegistrationAllowed: async (email: string): Promise<{ allowed: boolean; reason?: string }> => {
        try {
            const { data: settings, error } = await supabase
                .from('app_settings')
                .select('allow_public_registration, allowed_domains, require_email_whitelist')
                .eq('id', 'default')
                .single();

            if (error) {
                console.error('Error fetching app_settings:', error);
                // If settings don't exist, allow registration (fail-open)
                return { allowed: true };
            }

            // If public registration is allowed, let anyone register
            if (settings?.allow_public_registration) {
                return { allowed: true };
            }

            // Check if email domain is in whitelist
            const allowedDomains: string[] = settings?.allowed_domains || [];
            if (allowedDomains.length === 0) {
                return { 
                    allowed: false, 
                    reason: 'Registrace je zakázána. Kontaktujte administrátora.' 
                };
            }

            const emailLower = email.toLowerCase();
            const emailDomain = emailLower.split('@')[1];
            const isDomainAllowed = allowedDomains.some(domain => {
                const cleanDomain = domain.replace('@', '').toLowerCase().trim();
                return emailDomain === cleanDomain || emailDomain.endsWith('.' + cleanDomain);
            });

            if (!isDomainAllowed) {
                return { 
                    allowed: false, 
                    reason: `Registrace je povolena pouze pro domény: ${allowedDomains.join(', ')}` 
                };
            }

            // If email whitelist is required, check if this specific email is whitelisted
            if (settings?.require_email_whitelist) {
                const { data: whitelistCheck, error: whitelistError } = await supabase
                    .rpc('check_email_whitelist', { email_input: emailLower });

                if (whitelistError) {
                    console.error('Error checking email whitelist:', whitelistError);
                    // Fail-closed: if we can't check whitelist, deny registration
                    return { 
                        allowed: false, 
                        reason: 'Nelze ověřit oprávnění. Kontaktujte administrátora.' 
                    };
                }

                const isWhitelisted = whitelistCheck?.[0]?.is_whitelisted ?? false;
                if (!isWhitelisted) {
                    return { 
                        allowed: false, 
                        reason: 'Váš email není na seznamu povolených uživatelů. Kontaktujte administrátora pro přidání.' 
                    };
                }
            }

            return { allowed: true };
        } catch (e) {
            console.error('Error checking registration:', e);
            // Fail-open: if we can't check, allow registration
            return { allowed: true };
        }
    },

    getAppSettings: async (): Promise<{ allowPublicRegistration: boolean; allowedDomains: string[]; requireEmailWhitelist: boolean }> => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('allow_public_registration, allowed_domains, require_email_whitelist')
                .eq('id', 'default')
                .single();

            if (error) {
                console.error('Error fetching app_settings:', error);
                return { allowPublicRegistration: false, allowedDomains: [], requireEmailWhitelist: false };
            }

            return {
                allowPublicRegistration: data?.allow_public_registration || false,
                allowedDomains: data?.allowed_domains || [],
                requireEmailWhitelist: data?.require_email_whitelist || false
            };
        } catch (e) {
            console.error('Error loading app settings:', e);
            return { allowPublicRegistration: false, allowedDomains: [], requireEmailWhitelist: false };
        }
    },

    updateAppSettings: async (settings: { allowPublicRegistration: boolean; allowedDomains: string[]; requireEmailWhitelist?: boolean }): Promise<void> => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                id: 'default',
                allow_public_registration: settings.allowPublicRegistration,
                allowed_domains: settings.allowedDomains,
                require_email_whitelist: settings.requireEmailWhitelist ?? false,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            console.error('Error updating app_settings:', error);
            throw error;
        }
    },

    logout: async (): Promise<void> => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // New function to get user data from an existing session (avoids extra API call)
    getUserFromSession: async (session: any): Promise<User | null> => {
        if (!session?.user) {
            return null;
        }
        return authService._buildUserFromSession(session);
    },

    // Internal helper to build user object from session
    _buildUserFromSession: async (session: any): Promise<User | null> => {
        if (!session?.user) {
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
            console.log('[authService] Profile loaded', { is_admin: profile?.is_admin });
        } catch (e) {
            console.warn('[authService] Could not fetch profile', e);
        }

        // Fetch settings
        let settings = null;
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('preferences')
                .eq('user_id', session.user.id)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                console.error('[authService] Error fetching user settings:', error);
            } else if (data) {
                settings = data;
            }
        } catch (e) {
            console.error('[authService] Exception fetching settings', e);
        }

        const finalPreferences = settings?.preferences || {
            theme: 'system',
            primaryColor: '#607AFB',
            backgroundColor: '#f5f6f8'
        };

        return {
            id: session.user.id,
            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: profile?.is_admin ? 'admin' : 'user',
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email || 'U')}&background=random`,
            preferences: finalPreferences
        };
    },

    getCurrentUser: async (): Promise<User | null> => {
        console.log('[authService] getCurrentUser: Starting...');
        let session = null;
        try {
            // Reduced timeout from 30s to 5s for faster fail-fast
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Auth check timed out (5s)')), 5000)
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

        // Reuse shared helper for building user object
        return authService._buildUserFromSession(session);
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
