import { createClient } from '@supabase/supabase-js';
import { navigate } from '../shared/routing/router';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AUTH_STORAGE_KEY = 'crm-auth-token';
const USER_CACHE_KEY = 'crm-user-cache';
const SESSION_CREDENTIALS_KEY = 'session_credentials';
const REMEMBER_ME_STORAGE_KEY = 'crm-remember-me';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

/**
 * Helper to check if a header value is invalid (would cause fetch to throw on Windows Electron)
 */
const isInvalidHeaderValue = (value: unknown): boolean => {
  return value === undefined || value === null;
};

/**
 * Helper to check if an Authorization header value is corrupted
 */
const isCorruptedAuthValue = (value: string): boolean => {
  const trimmed = value.trim();
  return !trimmed || trimmed === 'Bearer' || trimmed === 'Bearer null' || trimmed === 'Bearer undefined';
};

/**
 * Global Headers constructor patch to sanitize header values.
 * On Windows Electron, native Headers constructor throws "Invalid value" error
 * when a header value is undefined/null. This patch intercepts and sanitizes values
 * BEFORE they reach the native constructor.
 */
const OriginalHeaders = globalThis.Headers;
class SafeHeaders extends OriginalHeaders {
  constructor(init?: HeadersInit) {
    // Sanitize init before passing to native Headers
    if (init) {
      if (init instanceof Headers || init instanceof OriginalHeaders) {
        // Headers instance - create sanitized copy
        const sanitized: [string, string][] = [];
        init.forEach((value, key) => {
          if (!isInvalidHeaderValue(value)) {
            if (key.toLowerCase() === 'authorization' && isCorruptedAuthValue(value)) {
              console.warn('[Headers] Skipping corrupted Authorization header');
              return;
            }
            sanitized.push([key, value]);
          } else {
            console.warn(`[Headers] Skipping invalid header "${key}": value is ${value}`);
          }
        });
        super(sanitized);
        return;
      } else if (Array.isArray(init)) {
        // Array of [key, value] pairs
        const sanitized: [string, string][] = [];
        for (const pair of init) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key, value] = pair;
            if (isInvalidHeaderValue(value)) {
              console.warn(`[Headers] Skipping invalid header "${key}": value is ${value}`);
              continue;
            }
            const strValue = String(value);
            if (key.toLowerCase() === 'authorization' && isCorruptedAuthValue(strValue)) {
              console.warn('[Headers] Skipping corrupted Authorization header');
              continue;
            }
            sanitized.push([String(key), strValue]);
          }
        }
        super(sanitized);
        return;
      } else if (typeof init === 'object') {
        // Plain object - filter out invalid values
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(init as Record<string, unknown>)) {
          if (isInvalidHeaderValue(value)) {
            console.warn(`[Headers] Skipping invalid header "${key}": value is ${value}`);
            continue;
          }
          const strValue = String(value);
          if (key.toLowerCase() === 'authorization' && isCorruptedAuthValue(strValue)) {
            console.warn('[Headers] Skipping corrupted Authorization header');
            continue;
          }
          sanitized[key] = strValue;
        }
        super(sanitized);
        return;
      }
    }
    super(init);
  }

  // Also override set/append to prevent invalid values
  set(name: string, value: string): void {
    if (isInvalidHeaderValue(value)) {
      console.warn(`[Headers.set] Skipping invalid header "${name}": value is ${value}`);
      return;
    }
    if (name.toLowerCase() === 'authorization' && isCorruptedAuthValue(value)) {
      console.warn('[Headers.set] Skipping corrupted Authorization header');
      return;
    }
    super.set(name, value);
  }

  append(name: string, value: string): void {
    if (isInvalidHeaderValue(value)) {
      console.warn(`[Headers.append] Skipping invalid header "${name}": value is ${value}`);
      return;
    }
    if (name.toLowerCase() === 'authorization' && isCorruptedAuthValue(value)) {
      console.warn('[Headers.append] Skipping corrupted Authorization header');
      return;
    }
    super.append(name, value);
  }
}

// Replace global Headers constructor
globalThis.Headers = SafeHeaders as typeof Headers;

/**
 * Global XMLHttpRequest interceptor to sanitize headers.
 * This catches any XHR requests that might bypass our safeFetch wrapper.
 */
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
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
 * (reuses isCorruptedAuthValue defined above for headers patch)
 */
const isCorruptedAuthHeader = isCorruptedAuthValue;

const getStorageValue = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const removeStorageValue = (storage: Storage, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
};

const setStorageValue = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
};

const shouldPersistSession = (): boolean => getStorageValue(window.localStorage, REMEMBER_ME_STORAGE_KEY) !== 'false';

const getPrimaryAuthStorage = (): Storage => (shouldPersistSession() ? window.localStorage : window.sessionStorage);
const getSecondaryAuthStorage = (): Storage => (shouldPersistSession() ? window.sessionStorage : window.localStorage);

const migrateAuthSessionIfNeeded = (): void => {
  const primary = getPrimaryAuthStorage();
  const secondary = getSecondaryAuthStorage();
  const primaryValue = getStorageValue(primary, AUTH_STORAGE_KEY);
  if (primaryValue) return;

  const secondaryValue = getStorageValue(secondary, AUTH_STORAGE_KEY);
  if (!secondaryValue) return;

  setStorageValue(primary, AUTH_STORAGE_KEY, secondaryValue);
  removeStorageValue(secondary, AUTH_STORAGE_KEY);
};

export const setRememberMePreference = (rememberMe: boolean): void => {
  setStorageValue(window.localStorage, REMEMBER_ME_STORAGE_KEY, rememberMe ? 'true' : 'false');
  migrateAuthSessionIfNeeded();
};

export const getStoredAuthSessionRaw = (): string | null => {
  migrateAuthSessionIfNeeded();
  const primary = getPrimaryAuthStorage();
  const secondary = getSecondaryAuthStorage();
  return getStorageValue(primary, AUTH_STORAGE_KEY) ?? getStorageValue(secondary, AUTH_STORAGE_KEY);
};

export const clearStoredSessionData = (): void => {
  removeStorageValue(window.localStorage, AUTH_STORAGE_KEY);
  removeStorageValue(window.sessionStorage, AUTH_STORAGE_KEY);
  removeStorageValue(window.localStorage, USER_CACHE_KEY);
  removeStorageValue(window.localStorage, SESSION_CREDENTIALS_KEY);
  removeStorageValue(window.sessionStorage, SESSION_CREDENTIALS_KEY);
};

const supabaseAuthStorage = {
  getItem: (key: string): string | null => {
    if (key !== AUTH_STORAGE_KEY) {
      return getStorageValue(window.localStorage, key) ?? getStorageValue(window.sessionStorage, key);
    }

    return getStoredAuthSessionRaw();
  },
  setItem: (key: string, value: string): void => {
    if (key !== AUTH_STORAGE_KEY) {
      setStorageValue(window.localStorage, key, value);
      return;
    }

    const primary = getPrimaryAuthStorage();
    const secondary = getSecondaryAuthStorage();
    setStorageValue(primary, key, value);
    removeStorageValue(secondary, key);
  },
  removeItem: (key: string): void => {
    if (key !== AUTH_STORAGE_KEY) {
      removeStorageValue(window.localStorage, key);
      removeStorageValue(window.sessionStorage, key);
      return;
    }

    removeStorageValue(window.localStorage, key);
    removeStorageValue(window.sessionStorage, key);
  },
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
          clearStoredSessionData();
        } catch { /* ignore */ }

        // Redirect to login after a short delay to let current operations settle
        setTimeout(() => {
          navigate('/login', { replace: true });
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
      // Use remember-me aware storage (localStorage for persistent, sessionStorage for session-only).
      storage: supabaseAuthStorage,
      storageKey: AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);
