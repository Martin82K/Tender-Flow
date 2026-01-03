/**
 * useLocalStorage Hook
 * Syncs state with localStorage with automatic serialization/deserialization.
 * Supports SSR and handles storage events for cross-tab synchronization.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Get initial value from localStorage with fallback
 */
function getStoredValue<T>(key: string, initialValue: T): T {
    if (typeof window === 'undefined') {
        return initialValue;
    }

    try {
        const item = window.localStorage.getItem(key);
        if (item === null) {
            return initialValue;
        }
        return JSON.parse(item) as T;
    } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return initialValue;
    }
}

/**
 * Hook for syncing state with localStorage
 * @param key - The localStorage key
 * @param initialValue - Default value if key doesn't exist
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    // State to store our value
    const [storedValue, setStoredValue] = useState<T>(() =>
        getStoredValue(key, initialValue)
    );

    // Return a wrapped version of useState's setter function that persists to localStorage
    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            try {
                // Allow value to be a function (like useState)
                const valueToStore = value instanceof Function ? value(storedValue) : value;

                // Save state
                setStoredValue(valueToStore);

                // Save to localStorage
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
            } catch (error) {
                console.warn(`Error setting localStorage key "${key}":`, error);
            }
        },
        [key, storedValue]
    );

    // Remove value from localStorage
    const removeValue = useCallback(() => {
        try {
            setStoredValue(initialValue);
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(key);
            }
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    // Listen for changes in other tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(JSON.parse(e.newValue));
                } catch {
                    setStoredValue(e.newValue as unknown as T);
                }
            } else if (e.key === key && e.newValue === null) {
                setStoredValue(initialValue);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
}

/**
 * Simple hook for boolean flags in localStorage
 */
export function useLocalStorageFlag(
    key: string,
    defaultValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
    const [value, setValue] = useLocalStorage(key, defaultValue);

    const toggle = useCallback(() => {
        setValue(prev => !prev);
    }, [setValue]);

    return [value, toggle, setValue];
}
