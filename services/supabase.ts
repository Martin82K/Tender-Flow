import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

/**
 * Global XMLHttpRequest interceptor to sanitize headers.
 * This catches any XHR requests that might bypass our safeFetch wrapper.
 */
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string) {
  // Validate header value before setting
  if (value === undefined || value === null) {
    console.warn(`[XHR] Skipping invalid header "${name}": value is ${value}`);
    return;
  }
  if (typeof value !== 'string') {
    console.warn(`[XHR] Converting non-string header "${name}" to string`);
    value = String(value);
  }
  // Check for empty or whitespace-only Authorization headers (corrupted tokens)
  if (name.toLowerCase() === 'authorization' && (!value.trim() || value.trim() === 'Bearer' || value.trim() === 'Bearer null' || value.trim() === 'Bearer undefined')) {
    console.warn(`[XHR] Skipping corrupted Authorization header: "${value}"`);
    return;
  }
  return originalXHRSetRequestHeader.call(this, name, value);
};

/**
 * Safe fetch wrapper that sanitizes headers before sending.
 * Prevents "TypeError: Failed to execute 'fetch' on 'Window': Invalid value"
 * which occurs when a header value is undefined/null or contains non-Latin1 characters.
 */
let _authErrorCount = 0;
const MAX_AUTH_ERRORS = 5;
const AUTH_ERROR_RESET_MS = 30_000;
let _authErrorResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Check if an Authorization header value is corrupted/invalid
 */
const isCorruptedAuthHeader = (value: string): boolean => {
  const trimmed = value.trim();
  return !trimmed || trimmed === 'Bearer' || trimmed === 'Bearer null' || trimmed === 'Bearer undefined';
};

const safeFetch: typeof fetch = async (input, init) => {
  // Sanitize headers: ensure all values are valid strings
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      // Headers object - check each entry
      const sanitized = new Headers();
      init.headers.forEach((value, key) => {
        if (typeof value === 'string') {
          // Check for corrupted auth headers
          if (key.toLowerCase() === 'authorization' && isCorruptedAuthHeader(value)) {
            console.warn(`[Supabase] Removing corrupted Authorization header`);
            return;
          }
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
        // Check for corrupted auth headers
        if (key.toLowerCase() === 'authorization' && isCorruptedAuthHeader(strValue)) {
          console.warn(`[Supabase] Removing corrupted Authorization header`);
          continue;
        }
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
          const strValue = String(value);
          // Check for corrupted auth headers
          if (key.toLowerCase() === 'authorization' && isCorruptedAuthHeader(strValue)) {
            console.warn(`[Supabase] Removing corrupted Authorization header`);
            continue;
          }
          sanitized.push([String(key), strValue]);
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
    // Track persistent auth/fetch errors (both fetch and XMLHttpRequest errors)
    const isInvalidValueError = error instanceof TypeError && (
      error.message.includes('Invalid value') ||
      error.message.includes('setRequestHeader') ||
      error.message.includes('Failed to execute')
    );

    if (isInvalidValueError) {
      _authErrorCount++;
      console.warn(`[Supabase] Auth error detected (${_authErrorCount}/${MAX_AUTH_ERRORS}):`, error.message);

      // Reset counter after a period of time
      if (_authErrorResetTimer) clearTimeout(_authErrorResetTimer);
      _authErrorResetTimer = setTimeout(() => {
        _authErrorCount = 0;
      }, AUTH_ERROR_RESET_MS);

      // If too many consecutive auth errors, the session is likely corrupted
      if (_authErrorCount >= MAX_AUTH_ERRORS) {
        console.error(
          `[Supabase] ${MAX_AUTH_ERRORS} consecutive auth errors detected. ` +
          `Session may be corrupted. Clearing session data.`
        );
        _authErrorCount = 0;

        // Clear the stored session to break the infinite retry loop
        try {
          window.localStorage.removeItem('crm-auth-token');
          window.localStorage.removeItem('crm-user-cache');
          window.localStorage.removeItem('session_credentials');
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
