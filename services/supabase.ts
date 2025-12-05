import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      // Use localStorage instead of cookies to avoid Safari blocking
      storage: window.localStorage,
      storageKey: 'crm-auth-token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

// Refresh session when user returns to tab (prevents unexpected logouts)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('[Supabase] Tab became visible, refreshing session...');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[Supabase] Session refresh error:', error);
        } else if (data.session) {
          // Session is valid, optionally refresh the token
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn('[Supabase] Token refresh warning:', refreshError);
          } else {
            console.log('[Supabase] Session refreshed successfully');
          }
        }
      } catch (e) {
        console.error('[Supabase] Visibility change handler error:', e);
      }
    }
  });

  // Also refresh on window focus (additional safety)
  window.addEventListener('focus', async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.auth.refreshSession();
      }
    } catch (e) {
      // Silent fail - don't interrupt user
    }
  });
}
