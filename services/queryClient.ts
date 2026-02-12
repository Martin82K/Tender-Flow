import { QueryClient } from "@tanstack/react-query";
import { clearStoredSessionData } from "./supabase";
import { navigate } from "../shared/routing/router";

/**
 * Check if an error is likely an auth/session error
 */
const isAuthError = (error: unknown): boolean => {
    if (!error) return false;
    const message = String((error as any)?.message || error).toLowerCase();
    return (
        message.includes('invalid value') ||
        message.includes('setrequestheader') ||
        message.includes('unauthorized') ||
        message.includes('jwt') ||
        message.includes('token') ||
        message.includes('session') ||
        message.includes('401')
    );
};

let authErrorCount = 0;
const MAX_AUTH_ERRORS_BEFORE_LOGOUT = 3;
let authErrorResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Handle auth errors globally - clear session if too many consecutive auth errors
 */
const handleQueryError = (error: unknown) => {
    if (isAuthError(error)) {
        authErrorCount++;
        console.warn(`[QueryClient] Auth error detected (${authErrorCount}/${MAX_AUTH_ERRORS_BEFORE_LOGOUT}):`, error);

        // Reset counter after 30 seconds of no errors
        if (authErrorResetTimer) clearTimeout(authErrorResetTimer);
        authErrorResetTimer = setTimeout(() => {
            authErrorCount = 0;
        }, 30000);

        // If too many auth errors, clear session and redirect to login
        if (authErrorCount >= MAX_AUTH_ERRORS_BEFORE_LOGOUT) {
            console.error('[QueryClient] Too many auth errors, clearing session...');
            authErrorCount = 0;

            try {
                clearStoredSessionData();
            } catch { /* ignore */ }

            // Redirect to login after a short delay
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 500);
        }
    }
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error) => {
                // Don't retry auth errors
                if (isAuthError(error)) {
                    handleQueryError(error);
                    return false;
                }
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: false,
            onError: handleQueryError,
        },
    },
});
