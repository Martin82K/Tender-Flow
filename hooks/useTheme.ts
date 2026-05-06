/**
 * Theme Management Hook
 * Handles theme state, localStorage persistence, CSS variables, and user preferences sync.
 */

import { useState, useEffect } from "react";
import { hexToRgb, mixHexColors } from "../utils/helpers";
import type { User } from "../types";
import { appAdapter } from "../services/platformAdapter";

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeSkin = 'classic' | 'industrial';

const DEFAULT_DARK_BACKGROUND = "#0f172a";
const DEFAULT_SKIN: ThemeSkin = "industrial";
export const DEFAULT_UI_SCALE = 1;
export const UI_SCALE_MIN = 0.5;
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.1;

export interface ThemeState {
    theme: ThemeMode;
    skin: ThemeSkin;
    primaryColor: string;
    backgroundColor: string;
    uiScale: number;
}

export interface UseThemeOptions {
    user?: User | null;
    onPreferencesUpdate?: (prefs: Partial<ThemeState>) => void;
}

export interface UseThemeReturn extends ThemeState {
    setTheme: (theme: ThemeMode) => void;
    setSkin: (skin: ThemeSkin) => void;
    setPrimaryColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
    setUiScale: (scale: number) => void;
    resetUiScale: () => void;
}

export const normalizeUiScale = (value: unknown): number => {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? value.trim() === ''
                ? Number.NaN
                : Number(value)
            : Number.NaN;

    if (!Number.isFinite(parsed)) return DEFAULT_UI_SCALE;

    const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, parsed));
    const rounded = Math.round((Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP) * 100) / 100;
    return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, rounded));
};

export const formatUiScalePercent = (value: unknown): string =>
    `${Math.round(normalizeUiScale(value) * 100)}%`;

/**
 * Get initial theme from localStorage with legacy fallback
 */
const getInitialTheme = (): ThemeMode => {
    if (typeof window === "undefined") return 'system';

    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        return storedTheme;
    }

    // Fallback for migration: check old darkMode key
    const oldDarkMode = localStorage.getItem('darkMode');
    if (oldDarkMode !== null) {
        return oldDarkMode === 'true' ? 'dark' : 'light';
    }

    return 'system';
};

const getInitialUiScale = (): number => {
    if (typeof window === "undefined") return DEFAULT_UI_SCALE;
    return normalizeUiScale(localStorage.getItem('uiScale'));
};

const normalizeSkin = (value: unknown): ThemeSkin =>
    value === "classic" || value === "industrial" ? value : DEFAULT_SKIN;

const getInitialSkin = (): ThemeSkin => {
    if (typeof window === "undefined") return DEFAULT_SKIN;
    return normalizeSkin(localStorage.getItem("skin") || localStorage.getItem("projectDetailSkin"));
};

/**
 * Custom hook for theme management
 */
export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
    const { user, onPreferencesUpdate } = options;

    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
    const [skin, setSkinState] = useState<ThemeSkin>(getInitialSkin);
    const [primaryColor, setPrimaryColorState] = useState("#607AFB");
    const [backgroundColor, setBackgroundColorState] = useState("#f5f6f8");
    const [uiScale, setUiScaleState] = useState<number>(getInitialUiScale);

    // Sync preferences from user profile
    // Priority: localStorage > user.preferences (to avoid overwriting user's local choice)
    useEffect(() => {
        if (user?.preferences) {
            // Only sync theme from user profile if localStorage doesn't have a value
            // This prevents the theme from being overwritten when user has already set it locally
            const storedTheme = localStorage.getItem('theme');
            const hasLocalTheme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system';

            if (!hasLocalTheme) {
                // Handle legacy user preferences if they exist
                if ((user.preferences as any).darkMode !== undefined && !user.preferences.theme) {
                    setThemeState((user.preferences as any).darkMode ? 'dark' : 'light');
                } else if (user.preferences.theme) {
                    setThemeState(user.preferences.theme);
                }
            }

            // Always sync colors (these don't have localStorage persistence)
            if (user.preferences.primaryColor) {
                setPrimaryColorState(user.preferences.primaryColor);
            }
            if (user.preferences.backgroundColor) {
                setBackgroundColorState(user.preferences.backgroundColor);
            }
            if (localStorage.getItem('uiScale') === null && user.preferences.uiScale !== undefined) {
                setUiScaleState(normalizeUiScale(user.preferences.uiScale));
            }
            if (localStorage.getItem('skin') === null && user.preferences.skin !== undefined) {
                setSkinState(normalizeSkin(user.preferences.skin));
            }
        }
    }, [user]);

    // Apply theme to document
    useEffect(() => {
        const applyTheme = () => {
            const isDark =
                theme === 'dark' ||
                (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

            if (isDark) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        };

        applyTheme();

        // Sync Electron's nativeTheme so the Windows/macOS title bar matches the app theme
        // instead of following the OS dark/light mode setting.
        void appAdapter.setThemeSource(theme);

        // Listen for system changes if theme is system
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme();
            if (typeof mediaQuery.addEventListener === 'function') {
                mediaQuery.addEventListener('change', handler);
                return () => mediaQuery.removeEventListener('change', handler);
            }
            mediaQuery.addListener(handler);
            return () => mediaQuery.removeListener(handler);
        }
    }, [theme]);

    // Update primary color CSS variable — only when user preferences are provided
    // to prevent instances without user context from resetting the color to default
    useEffect(() => {
        if (user?.preferences?.primaryColor || primaryColor !== '#607AFB') {
            const primaryRgb = hexToRgb(primaryColor);
            document.documentElement.style.setProperty(
                "--tf-color-primary-rgb",
                primaryRgb
            );
            document.documentElement.style.setProperty(
                "--color-primary",
                `rgb(${primaryRgb})`
            );
        }
    }, [primaryColor, user]);

    // Update background CSS variable
    useEffect(() => {
        const darkBackground = mixHexColors(backgroundColor, DEFAULT_DARK_BACKGROUND, 0.22);

        document.documentElement.style.setProperty(
            "--tf-color-background-light",
            backgroundColor
        );
        document.documentElement.style.setProperty(
            "--tf-color-background-dark",
            darkBackground
        );
        document.documentElement.style.setProperty(
            "--color-background",
            backgroundColor
        );
        document.documentElement.style.setProperty(
            "--color-background-light",
            backgroundColor
        );
        document.documentElement.style.setProperty(
            "--color-background-dark",
            darkBackground
        );
    }, [backgroundColor]);

    useEffect(() => {
        const normalized = normalizeUiScale(uiScale);

        document.documentElement.style.setProperty("--tf-ui-scale", String(normalized));
        document.documentElement.style.setProperty("--tf-ui-scale-percent", formatUiScalePercent(normalized));
        document.documentElement.style.overflowX = "hidden";
    }, [uiScale]);

    useEffect(() => {
        document.documentElement.dataset.skin = skin;
    }, [skin]);

    // Wrapper functions that persist and sync
    const setTheme = (newTheme: ThemeMode) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        localStorage.removeItem('darkMode'); // Remove legacy key
        onPreferencesUpdate?.({ theme: newTheme });
    };

    const setSkin = (newSkin: ThemeSkin) => {
        const normalized = normalizeSkin(newSkin);
        setSkinState(normalized);
        localStorage.setItem('skin', normalized);
        localStorage.setItem('projectDetailSkin', normalized);
        onPreferencesUpdate?.({ skin: normalized });
    };

    const setPrimaryColor = (color: string) => {
        setPrimaryColorState(color);
        onPreferencesUpdate?.({ primaryColor: color });
    };

    const setBackgroundColor = (color: string) => {
        setBackgroundColorState(color);
        onPreferencesUpdate?.({ backgroundColor: color });
    };

    const setUiScale = (scale: number) => {
        const normalized = normalizeUiScale(scale);
        setUiScaleState(normalized);
        localStorage.setItem('uiScale', String(normalized));
        onPreferencesUpdate?.({ uiScale: normalized });
    };

    const resetUiScale = () => {
        setUiScaleState(DEFAULT_UI_SCALE);
        localStorage.removeItem('uiScale');
        onPreferencesUpdate?.({ uiScale: DEFAULT_UI_SCALE });
    };

    return {
        theme,
        skin,
        primaryColor,
        backgroundColor,
        uiScale,
        setTheme,
        setSkin,
        setPrimaryColor,
        setBackgroundColor,
        setUiScale,
        resetUiScale,
    };
};
