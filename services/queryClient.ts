import { QueryClient } from "@tanstack/react-query";
import { authSessionService } from "./authSessionService";
import { logIncident } from "./incidentLogger";
import { summarizeErrorForLog } from "@/shared/security/logSanitizer";

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
        const message = String((error as any)?.message || error);
        authErrorCount++;
        console.warn(`[QueryClient] Auth error detected (${authErrorCount}/${MAX_AUTH_ERRORS_BEFORE_LOGOUT}):`, summarizeErrorForLog(error));
        void logIncident({
            severity: "warn",
            source: "react-query",
            category: "network",
            code: "QUERY_AUTH_ERROR",
            message: `React Query auth error: ${message}`,
            stack: error instanceof Error ? error.stack : null,
            context: {
                operation: "react_query.on_error",
                retry_count: authErrorCount,
            },
        });

        // Reset counter after 30 seconds of no errors
        if (authErrorResetTimer) clearTimeout(authErrorResetTimer);
        authErrorResetTimer = setTimeout(() => {
            authErrorCount = 0;
        }, 30000);

        // If too many auth errors, clear session and redirect to login
        if (authErrorCount >= MAX_AUTH_ERRORS_BEFORE_LOGOUT) {
            console.error('[QueryClient] Too many auth errors, clearing session...');
            authErrorCount = 0;
            void logIncident({
                severity: "error",
                source: "react-query",
                category: "network",
                code: "QUERY_AUTH_ERROR_THRESHOLD",
                message: "Too many auth errors in query client; triggering auth invalidation",
                context: {
                    operation: "react_query.auth_threshold",
                    retry_count: MAX_AUTH_ERRORS_BEFORE_LOGOUT,
                },
                notifyUser: true,
            });

            void authSessionService.invalidateAuthState({
                navigateToLogin: true,
                reason: "auth_fetch_errors",
            });
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
