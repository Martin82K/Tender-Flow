/**
 * General Helper Functions
 * Extracted from App.tsx for better modularity and reusability
 */

// Admin emails for checking admin status
const ADMIN_EMAILS: readonly string[] = [
    "martinkalkus82@gmail.com",
    "kalkus@baustav.cz",
];

/**
 * Check if user email belongs to an admin
 */
export const isUserAdmin = (email: string | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email);
};

/**
 * Convert hex color to RGB string for CSS variables
 * @param hex - Hex color string (with or without #)
 * @returns RGB values as space-separated string, e.g. "96 122 251"
 */
export const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : "96 122 251"; // Default Fallback (primary color)
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Wrap a promise with a timeout
 * @throws Error if promise doesn't resolve within timeout
 */
export const withTimeout = async <T>(
    promise: PromiseLike<T>,
    ms: number,
    message?: string
): Promise<T> => {
    let timeoutId: number | null = null;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise<T>((_, reject) => {
                timeoutId = window.setTimeout(() => {
                    reject(new Error(message || `Timeout after ${ms}ms`));
                }, ms);
            }),
        ]);
    } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
};

/**
 * Retry a function with exponential backoff
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    opts?: { retries?: number; baseDelayMs?: number }
): Promise<T> => {
    const retries = opts?.retries ?? 1;
    const baseDelayMs = opts?.baseDelayMs ?? 300;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt >= retries) break;
            await sleep(baseDelayMs * Math.pow(2, attempt));
        }
    }
    throw lastError;
};
