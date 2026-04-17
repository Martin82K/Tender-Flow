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

const hexToChannels = (hex: string): [number, number, number] => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return [15, 23, 42];

    return [
        parseInt(match[1], 16),
        parseInt(match[2], 16),
        parseInt(match[3], 16),
    ];
};

const toHex = (value: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, "0");
};

/**
 * Blend two hex colors.
 * weightA is the contribution of the first color, between 0 and 1.
 */
export const mixHexColors = (hexA: string, hexB: string, weightA = 0.5): string => {
    const ratio = Math.max(0, Math.min(1, weightA));
    const [r1, g1, b1] = hexToChannels(hexA);
    const [r2, g2, b2] = hexToChannels(hexB);

    const r = r1 * ratio + r2 * (1 - ratio);
    const g = g1 * ratio + g2 * (1 - ratio);
    const b = b1 * ratio + b2 * (1 - ratio);

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
