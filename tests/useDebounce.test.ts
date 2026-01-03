/**
 * Unit tests for useDebounce hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../hooks/useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));
        expect(result.current).toBe('initial');
    });

    it('should debounce value updates', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'initial' } }
        );

        expect(result.current).toBe('initial');

        // Update value
        rerender({ value: 'updated' });

        // Should still be initial (not enough time passed)
        expect(result.current).toBe('initial');

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Now should be updated
        expect(result.current).toBe('updated');
    });

    it('should reset timer on value change', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        );

        rerender({ value: 'b' });
        act(() => {
            vi.advanceTimersByTime(200);
        });

        // Change again before timer fires
        rerender({ value: 'c' });

        // Should still be 'a'
        expect(result.current).toBe('a');

        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Should be 'c', not 'b'
        expect(result.current).toBe('c');
    });
});

describe('useDebouncedCallback', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should debounce callback execution', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        // Call debounced function multiple times
        result.current('a');
        result.current('b');
        result.current('c');

        // Callback should not be called yet
        expect(callback).not.toHaveBeenCalled();

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Callback should be called once with last argument
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('c');
    });
});
