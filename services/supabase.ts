import { createClient } from '@supabase/supabase-js';

// ========================================================================
// HEADERS SAFETY PATCH
// Prevents "TypeError: Failed to execute 'set' on 'Headers': Invalid value"
// which occurs when Supabase internal code (fetchWithAuth) passes
// undefined/null header values. Common on Chromium-based Electron apps.
// Must run before createClient() so Supabase captures the patched Headers.
// ========================================================================
(() => {
  if (typeof globalThis.Headers === 'undefined') return;

  const OriginalHeaders = globalThis.Headers;

  // Patch .set() to gracefully skip undefined/null values
  const origSet = OriginalHeaders.prototype.set;
  OriginalHeaders.prototype.set = function(name: string, value: string) {
    if (value === undefined || value === null) return;
    return origSet.call(this, name, String(value));
  };

  // Patch .append() similarly
  const origAppend = OriginalHeaders.prototype.append;
  OriginalHeaders.prototype.append = function(name: string, value: string) {
    if (value === undefined || value === null) return;
    return origAppend.call(this, name, String(value));
  };

  // Replace constructor with sanitizing version to handle
  // new Headers({ key: undefined }) which throws in Chromium
  // @ts-ignore - extending native Headers with broader init type
  globalThis.Headers = class SafeHeaders extends OriginalHeaders {
    constructor(init?: HeadersInit | Record<string, unknown>) {
      if (init && typeof init === 'object' && !(init instanceof OriginalHeaders) && !Array.isArray(init)) {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(init)) {
          if (value !== undefined && value !== null) {
            sanitized[key] = String(value);
          }
        }
        super(sanitized);
      } else {
        super(init as HeadersInit);
      }
    }
  } as typeof Headers;
})();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

/**
 * Safe fetch wrapper that sanitizes headers before sending.
 * Prevents "TypeError: Failed to execute 'fetch' on 'Window': Invalid value"
 * which occurs when a header value is undefined/null or contains non-Latin1 characters.
 */
let _authErrorCount = 0;
const MAX_AUTH_ERRORS = 5;
const AUTH_ERROR_RESET_MS = 30_000;
let _authErrorResetTimer: ReturnType<typeof setTimeout> | null = null;

const safeFetch: typeof fetch = async (input, init) => {
  // Sanitize headers: ensure all values are valid strings
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      // Headers object - check each entry
      const sanitized = new Headers();
      init.headers.forEach((value, key) => {
        if (typeof value === 'string') {
          sanitized.set(key, value);
        } else {
          console.warn(`[Supabase] Removing invalid header "${key}": value is not a string`);
        }
      });
      init = { ...init, headers: sanitized };
    } else if (typeof init.headers === 'object' && !Array.isArray(init.headers)) {
      // Plain object - filter out invalid values
      const sanitized: Record<string, string> = {};
      for (const [key, value] of Object.entries(init.headers as Record<string, unknown>)) {
        if (value === undefined || value === null) {
          console.warn(`[Supabase] Removing invalid header "${key}": value is ${value}`);
          continue;
        }
        const strValue = String(value);
        sanitized[key] = strValue;
      }
      init = { ...init, headers: sanitized };
    } else if (Array.isArray(init.headers)) {
      // Array of [key, value] pairs
      const sanitized: [string, string][] = [];
      for (const pair of init.headers) {
        if (Array.isArray(pair) && pair.length >= 2) {
          const [key, value] = pair;
          if (value === undefined || value === null) {
            console.warn(`[Supabase] Removing invalid header "${key}": value is ${value}`);
            continue;
          }
          sanitized.push([String(key), String(value)]);
        }
      }
      init = { ...init, headers: sanitized };
    }
  }

  try {
    const response = await fetch(input, init);

    // Reset error counter on success
    if (_authErrorCount > 0) {
      _authErrorCount = 0;
    }

    return response;
  } catch (error) {
    // Track persistent auth/fetch errors
    if (error instanceof TypeError && error.message.includes('Invalid value')) {
      _authErrorCount++;

      // Reset counter after a period of time
      if (_authErrorResetTimer) clearTimeout(_authErrorResetTimer);
      _authErrorResetTimer = setTimeout(() => {
        _authErrorCount = 0;
      }, AUTH_ERROR_RESET_MS);

      // If too many consecutive auth errors, the session is likely corrupted
      if (_authErrorCount >= MAX_AUTH_ERRORS) {
        console.error(
          `[Supabase] ${MAX_AUTH_ERRORS} consecutive "Invalid value" errors detected. ` +
          `Session may be corrupted. Clearing session data.`
        );
        _authErrorCount = 0;

        // Clear the stored session to break the infinite retry loop
        // Also clear demo session flag to prevent false demo detection
        try {
          window.localStorage.removeItem('crm-auth-token');
          window.localStorage.removeItem('crm-user-cache');
          window.localStorage.removeItem('demo_session');
          window.localStorage.removeItem('demo_data');
        } catch { /* ignore */ }

        // Redirect to login after a short delay to let current operations settle
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }

    throw error;
  }
};

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    global: {
      fetch: safeFetch,
    },
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
