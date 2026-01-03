/**
 * Unit tests for useLocalStorage hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, useLocalStorageFlag } from '../hooks/useLocalStorage';

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should return initial value when key does not exist', () => {
        const { result } = renderHook(() => useLocalStorage('testKey', 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('should return stored value when key exists', () => {
        localStorage.setItem('testKey', JSON.stringify('stored'));
        const { result } = renderHook(() => useLocalStorage('testKey', 'default'));
        expect(result.current[0]).toBe('stored');
    });

    it('should update value and persist to localStorage', () => {
        const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
        expect(JSON.parse(localStorage.getItem('testKey')!)).toBe('updated');
    });

    it('should support function updater', () => {
        const { result } = renderHook(() => useLocalStorage<number>('counter', 0));

        act(() => {
            result.current[1](prev => prev + 1);
        });

        expect(result.current[0]).toBe(1);
    });

    it('should remove value from localStorage', () => {
        localStorage.setItem('testKey', JSON.stringify('value'));
        const { result } = renderHook(() => useLocalStorage('testKey', 'default'));

        expect(result.current[0]).toBe('value');

        act(() => {
            result.current[2](); // removeValue
        });

        expect(result.current[0]).toBe('default');
        expect(localStorage.getItem('testKey')).toBeNull();
    });

    it('should handle objects', () => {
        const { result } = renderHook(() =>
            useLocalStorage('user', { name: 'John', age: 30 })
        );

        expect(result.current[0]).toEqual({ name: 'John', age: 30 });

        act(() => {
            result.current[1]({ name: 'Jane', age: 25 });
        });

        expect(result.current[0]).toEqual({ name: 'Jane', age: 25 });
    });
});

describe('useLocalStorageFlag', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should toggle boolean value', () => {
        const { result } = renderHook(() => useLocalStorageFlag('flag', false));

        expect(result.current[0]).toBe(false);

        act(() => {
            result.current[1](); // toggle
        });

        expect(result.current[0]).toBe(true);

        act(() => {
            result.current[1](); // toggle again
        });

        expect(result.current[0]).toBe(false);
    });
});
