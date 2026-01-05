/**
 * Theme Management Hook
 * Handles theme state, localStorage persistence, CSS variables, and user preferences sync.
 */

import { useState, useEffect } from "react";
import { hexToRgb } from "../utils/helpers";
import type { User } from "../types";

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
    theme: ThemeMode;
    primaryColor: string;
    backgroundColor: string;
}

export interface UseThemeOptions {
    user?: User | null;
    onPreferencesUpdate?: (prefs: Partial<ThemeState>) => void;
}

export interface UseThemeReturn extends ThemeState {
    setTheme: (theme: ThemeMode) => void;
    setPrimaryColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
}

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

/**
 * Custom hook for theme management
 */
export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
    const { user, onPreferencesUpdate } = options;

    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
    const [primaryColor, setPrimaryColorState] = useState("#607AFB");
    const [backgroundColor, setBackgroundColorState] = useState("#f5f6f8");

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

    // Update primary color CSS variable
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--color-primary",
            hexToRgb(primaryColor)
        );
    }, [primaryColor]);

    // Update background CSS variable
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--color-background",
            backgroundColor
        );
    }, [backgroundColor]);

    // Wrapper functions that persist and sync
    const setTheme = (newTheme: ThemeMode) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        localStorage.removeItem('darkMode'); // Remove legacy key
        onPreferencesUpdate?.({ theme: newTheme });
    };

    const setPrimaryColor = (color: string) => {
        setPrimaryColorState(color);
        onPreferencesUpdate?.({ primaryColor: color });
    };

    const setBackgroundColor = (color: string) => {
        setBackgroundColorState(color);
        onPreferencesUpdate?.({ backgroundColor: color });
    };

    return {
        theme,
        primaryColor,
        backgroundColor,
        setTheme,
        setPrimaryColor,
        setBackgroundColor,
    };
};
