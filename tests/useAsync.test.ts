/**
 * Unit tests for useAsync hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync } from '../hooks/useAsync';

describe('useAsync', () => {
    it('should start with initial state', () => {
        const asyncFn = vi.fn().mockResolvedValue('data');
        const { result } = renderHook(() => useAsync(asyncFn, false));

        expect(result.current.data).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should execute and return data on success', async () => {
        const asyncFn = vi.fn().mockResolvedValue('success data');
        const { result } = renderHook(() => useAsync(asyncFn, false));

        await act(async () => {
            await result.current.execute();
        });

        expect(result.current.data).toBe('success data');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
        const error = new Error('Test error');
        const asyncFn = vi.fn().mockRejectedValue(error);
        const { result } = renderHook(() => useAsync(asyncFn, false));

        await act(async () => {
            await result.current.execute();
        });

        expect(result.current.data).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toEqual(error);
    });

    it('should set loading state during execution', async () => {
        let resolvePromise: (value: string) => void;
        const asyncFn = vi.fn().mockImplementation(() =>
            new Promise<string>(resolve => {
                resolvePromise = resolve;
            })
        );

        const { result } = renderHook(() => useAsync(asyncFn, false));

        let executePromise: Promise<string | null>;
        act(() => {
            executePromise = result.current.execute();
        });

        // Should be loading
        expect(result.current.isLoading).toBe(true);

        await act(async () => {
            resolvePromise!('done');
            await executePromise;
        });

        // Should no longer be loading
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBe('done');
    });

    it('should reset state', async () => {
        const asyncFn = vi.fn().mockResolvedValue('data');
        const { result } = renderHook(() => useAsync(asyncFn, false));

        await act(async () => {
            await result.current.execute();
        });

        expect(result.current.data).toBe('data');

        act(() => {
            result.current.reset();
        });

        expect(result.current.data).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should pass arguments to async function', async () => {
        const asyncFn = vi.fn().mockImplementation((a: number, b: number) =>
            Promise.resolve(a + b)
        );
        const { result } = renderHook(() => useAsync(asyncFn, false));

        await act(async () => {
            await result.current.execute(5, 3);
        });

        expect(asyncFn).toHaveBeenCalledWith(5, 3);
        expect(result.current.data).toBe(8);
    });
});
