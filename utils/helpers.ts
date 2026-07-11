/**
 * General Helper Functions
 * Extracted from App.tsx for better modularity and reusability
 */

/**
 * Check if user email belongs to an admin
 */
export { isUserAdmin } from "@/shared/auth/adminAccess";
export { sleep, withRetry, withTimeout } from "@shared/async/asyncControl";

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
