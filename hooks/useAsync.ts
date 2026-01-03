/**
 * useAsync Hook
 * Handles async operations with loading, error, and data states.
 * Provides execute function for manual triggering.
 */

import { useState, useCallback, useEffect } from 'react';

export interface AsyncState<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

export interface UseAsyncReturn<T, Args extends any[]> extends AsyncState<T> {
    execute: (...args: Args) => Promise<T | null>;
    reset: () => void;
}

/**
 * Hook for handling async operations
 * @param asyncFunction - The async function to execute
 * @param immediate - Whether to execute immediately on mount
 * @returns State and control functions
 */
export function useAsync<T, Args extends any[] = []>(
    asyncFunction: (...args: Args) => Promise<T>,
    immediate: boolean = false
): UseAsyncReturn<T, Args> {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        isLoading: immediate,
        error: null,
    });

    // Execute the async function
    const execute = useCallback(
        async (...args: Args): Promise<T | null> => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            try {
                const result = await asyncFunction(...args);
                setState({ data: result, isLoading: false, error: null });
                return result;
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                setState({ data: null, isLoading: false, error: err });
                return null;
            }
        },
        [asyncFunction]
    );

    // Reset state
    const reset = useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    // Execute immediately if requested
    useEffect(() => {
        if (immediate) {
            execute(...([] as unknown as Args));
        }
    }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

    return { ...state, execute, reset };
}

/**
 * Simplified hook for fetch operations
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param immediate - Whether to fetch immediately
 */
export function useFetch<T>(
    url: string,
    options?: RequestInit,
    immediate: boolean = true
): UseAsyncReturn<T, [RequestInit?]> {
    const fetchData = useCallback(
        async (overrideOptions?: RequestInit): Promise<T> => {
            const response = await fetch(url, { ...options, ...overrideOptions });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },
        [url, options]
    );

    return useAsync(fetchData, immediate);
}
