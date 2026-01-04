import { supabase } from './supabase';
import { SubscriptionTier, User } from '../types';

const DEFAULT_PREFERENCES = {
    theme: 'system',
    primaryColor: '#607AFB',
    backgroundColor: '#f5f6f8'
} as const;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms)),
    ]);
};

// Admin email configuration (matches Sidebar.tsx)
const ADMIN_EMAILS = ["martinkalkus82@gmail.com", "kalkus@baustav.cz"];

const getCachedSession = (): any | null => {
    try {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage?.getItem('crm-auth-token');
        if (!raw) return null;
        const parsed = JSON.parse(raw);

        // Supabase typically stores the Session object directly, but handle a few shapes defensively.
        if (parsed?.access_token && parsed?.user) return parsed;
        if (parsed?.currentSession?.access_token && parsed?.currentSession?.user) return parsed.currentSession;
        if (parsed?.session?.access_token && parsed?.session?.user) return parsed.session;
        if (parsed?.data?.session?.access_token && parsed?.data?.session?.user) return parsed.data.session;

        return null;
    } catch {
        return null;
    }
};

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) throw new Error('No user returned from login');

        // Prefer the session returned by sign-in (avoids extra auth roundtrip that can hang).
        if (data.session) {
            try {
                const user = await withTimeout(authService.getUserFromSession(data.session), 1000, 'User hydrate');
                if (user) return user;
            } catch (e) {
                console.warn('[authService] login: hydration slow/failed, using fallback user', e);
            }
        }

        // Fallback: return minimal user object; AuthContext auth events will hydrate further.
        const isSystemAdmin = data.user.email ? ADMIN_EMAILS.includes(data.user.email) : false;
        return {
            id: data.user.id,
            name: (data.user.user_metadata as any)?.name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email || '',
            role: isSystemAdmin ? 'admin' : 'user',
            subscriptionTier: isSystemAdmin ? 'admin' : 'free',
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.email || 'U')}&background=random`,
            preferences: DEFAULT_PREFERENCES
        };
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

        // Prefer session returned by sign-up (when email confirmation is disabled).
        if (data.session) {
            const user = await authService.getUserFromSession(data.session);
            if (user) return user;
        }

        // If there's no session, user is not signed in (e.g. email confirmation required).
        throw new Error('Registrace proběhla, ale nebyla vytvořena session. Zkontrolujte email pro potvrzení.');
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

    getExcelMergerMirrorUrl: async (): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('excel_merger_mirror_url')
                .eq('id', 'default')
                .single();
            if (error) {
                // Missing column or no permission should not break the app.
                console.warn('Error fetching excel_merger_mirror_url:', error);
                return null;
            }
            const url = (data as any)?.excel_merger_mirror_url as string | null | undefined;
            return url ? String(url) : null;
        } catch (e) {
            console.warn('Error loading excel_merger_mirror_url:', e);
            return null;
        }
    },

    updateExcelMergerMirrorUrl: async (url: string | null): Promise<void> => {
        const { error } = await supabase
            .from('app_settings')
            .upsert(
                {
                    id: 'default',
                    excel_merger_mirror_url: url,
                    updated_at: new Date().toISOString(),
                } as any,
                { onConflict: 'id' }
            );

        if (error) {
            console.error('Error updating excel_merger_mirror_url:', error);
            const message = String((error as any)?.message || '');
            const code = String((error as any)?.code || '');
            const lower = message.toLowerCase();

            const missingColumn =
                code === '42703' ||
                (lower.includes('schema cache') && lower.includes('excel_merger_mirror_url')) ||
                (lower.includes('column') &&
                    lower.includes('excel_merger_mirror_url') &&
                    (lower.includes('does not exist') || lower.includes('not exist')));

            if (missingColumn) {
                throw new Error(
                    "V databázi chybí sloupec `app_settings.excel_merger_mirror_url` (nebo ještě není načtený v schema cache).\n\n1) Nahraj migraci `supabase/migrations/20260103000100_excel_merger_url_app_settings.sql` do Supabase.\n2) Obnov schema cache (Supabase Dashboard → Settings → API → Reload schema cache), případně spusť SQL: `select pg_notify('pgrst', 'reload schema');`.\n3) Zkus uložit znovu."
                );
            }

            const permissionDenied =
                code === '42501' ||
                lower.includes('permission denied') ||
                lower.includes('insufficient_privilege') ||
                lower.includes('violates row-level security');

            if (permissionDenied) {
                throw new Error(
                    'Nemáš oprávnění uložit hodnotu do `app_settings`. Zkontroluj RLS/policies pro tabulku `app_settings` (update/upsert pro admina).'
                );
            }

            const details = String((error as any)?.details || '').trim();
            const hint = String((error as any)?.hint || '').trim();
            const tail = [details, hint].filter(Boolean).join('\n');
            throw new Error(tail ? `${message}\n${tail}` : (message || 'Neznámá chyba'));
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
        try {
            return await authService._buildUserFromSession(session);
        } catch (e) {
            console.warn('[authService] Failed to build user from session, returning fallback user', e);
            const isSystemAdmin = session.user.email ? ADMIN_EMAILS.includes(session.user.email) : false;
            return {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
                role: isSystemAdmin ? 'admin' : 'user',
                subscriptionTier: isSystemAdmin ? 'admin' : 'free',
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email || 'U')}&background=random`,
                preferences: DEFAULT_PREFERENCES
            };
        }
    },

    // Internal helper to build user object from session
    _buildUserFromSession: async (session: any): Promise<User | null> => {
        if (!session?.user) {
            return null;
        }

        // Hydration should never block app navigation.
        const queryTimeoutMs = 6000;

        const profilePromise = (async () => {
            try {
                const res = await withTimeout(
                    Promise.resolve(supabase
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', session.user.id)
                        .single()),
                    queryTimeoutMs,
                    'Profile load'
                );
                const { data, error } = res as any;
                if (error) {
                    console.warn('[authService] Error fetching profile', error);
                    return null;
                }
                console.log('[authService] Profile loaded', { is_admin: data?.is_admin });
                return data ?? null;
            } catch (e) {
                console.warn('[authService] Could not fetch profile', e);
                return null;
            }
        })();

        const settingsPromise = (async () => {
            try {
                const res = await withTimeout(
                    Promise.resolve(supabase
                        .from('user_settings')
                        .select('preferences')
                        .eq('user_id', session.user.id)
                        .single()),
                    queryTimeoutMs,
                    'User settings load'
                );
                const { data, error } = res as any;
                if (error && error.code !== 'PGRST116') {
                    console.error('[authService] Error fetching user settings:', error);
                    return null;
                }
                return data ?? null;
            } catch (e) {
                console.warn('[authService] Could not fetch user settings', e);
                return null;
            }
        })();

        const [profile, settings] = await Promise.all([profilePromise, settingsPromise]);

        // Attempt to get organization subscription tier (with optional per-user override)
        let subscriptionTier: SubscriptionTier = 'free';
        let subscriptionTierOverride: SubscriptionTier | null = null;
        
        // Organization info - declared outside try block for proper scope
        let organizationId: string | undefined;
        let organizationType: 'personal' | 'business' | undefined;
        let organizationName: string | undefined;
        
        try {
            const overrideRes = await withTimeout(
                Promise.resolve(
                    supabase
                        .from('user_profiles')
                        .select('subscription_tier_override')
                        .eq('user_id', session.user.id)
                        .maybeSingle()
                ),
                queryTimeoutMs,
                'Subscription override load'
            );
            const { data: overrideRow, error: overrideError } = overrideRes as any;
            if (!overrideError) {
                const override = String(overrideRow?.subscription_tier_override || '').trim().toLowerCase();
                if (override === 'free' || override === 'pro' || override === 'enterprise' || override === 'admin') {
                    subscriptionTierOverride = override as SubscriptionTier;
                }
            }

            if (subscriptionTierOverride) {
                subscriptionTier = subscriptionTierOverride;
            }
            
            // Always try to get organization info
            const orgMemberRes = await withTimeout(
                Promise.resolve(
                    supabase
                        .from('organization_members')
                        .select('organization_id')
                        .eq('user_id', session.user.id)
                        .limit(1)
                        .maybeSingle()
                ),
                queryTimeoutMs,
                'Org member load'
            );
            const { data: orgMember } = orgMemberRes as any;

            if (orgMember?.organization_id) {
                organizationId = orgMember.organization_id;
                
                const orgRes = await withTimeout(
                    Promise.resolve(
                        supabase
                            .from('organizations')
                            .select('subscription_tier, type, name')
                            .eq('id', orgMember.organization_id)
                            .single()
                    ),
                    queryTimeoutMs,
                    'Organization load'
                );
                const { data: org } = orgRes as any;

                if (org) {
                    organizationType = org.type as 'personal' | 'business' | undefined;
                    organizationName = org.name;
                    
                    if (!subscriptionTierOverride && org.subscription_tier) {
                        const tier = String(org.subscription_tier || '').trim().toLowerCase();
                        if (tier === 'free' || tier === 'pro' || tier === 'enterprise' || tier === 'admin') {
                            subscriptionTier = tier as SubscriptionTier;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[authService] Could not fetch org subscription tier', e);
        }

        const isSystemAdmin = session.user.email ? ADMIN_EMAILS.includes(session.user.email) : false;
        const finalRole = isSystemAdmin ? 'admin' : (profile?.is_admin ? 'admin' : 'user');
        const finalTier = isSystemAdmin ? 'admin' : subscriptionTier;

        const finalPreferences = settings?.preferences || DEFAULT_PREFERENCES;

        return {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: finalRole as any,
            subscriptionTier: finalTier as any,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email || 'U')}&background=random`,
            preferences: finalPreferences,
            organizationId,
            organizationType,
            organizationName
        };
    },

    getCurrentUser: async (): Promise<User | null> => {
        console.log('[authService] getCurrentUser: Starting...');

        // Fast path: build user from cached session in localStorage (no network / no auth locks).
        const cachedSession = getCachedSession();
        if (cachedSession?.user) {
            console.log('[authService] getCurrentUser: Using cached session', cachedSession.user?.id);
            return authService.getUserFromSession(cachedSession);
        }

        let session = null;
        try {
            // `getSession()` may refresh tokens over network; keep timeout lenient to avoid
            // false negatives during cold starts / slow connections.
            const timeoutMs = 3000;
            const { data } = await withTimeout(supabase.auth.getSession(), timeoutMs, 'Auth check') as any;
            session = data?.session || null;
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
