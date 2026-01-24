/**
 * Unit tests for useDocHubIntegration hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocHubIntegration } from '../hooks/useDocHubIntegration';
import { supabase } from '../services/supabase';
import { invokeAuthedFunction } from '../services/functionsClient';

// Mock dependencies
vi.mock('../services/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        })),
    }
}));

vi.mock('../services/functionsClient', () => ({
    invokeAuthedFunction: vi.fn(),
}));

const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    docHubEnabled: false,
    docHubRootLink: '',
    docHubRootName: '',
    docHubProvider: null,
    docHubMode: null,
    docHubStatus: 'disconnected',
    docHubAutoCreateEnabled: false,
    docHubStructureV1: {},
};

describe('useDocHubIntegration', () => {
    const onUpdateMock = vi.fn();
    const originalWindow = { ...window };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window mocks
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalWindow.location, href: '' }
        });
        (window as any).gapi = undefined;
        (window as any).google = undefined;
    });

    it('should initialize with default state', () => {
        const { result } = renderHook(() => useDocHubIntegration(mockProject as any, onUpdateMock));

        expect(result.current.state.enabled).toBe(false);
        expect(result.current.state.status).toBe('disconnected');
        expect(result.current.state.isConnecting).toBe(false);
        expect(result.current.state.isConnected).toBe(false);
    });

    it('should sync state from project props', async () => {
        const connectedProject = {
            ...mockProject,
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubRootId: 'root-123',
            docHubRootLink: 'https://drive.google.com/...'
        };
        const { result } = renderHook(() => useDocHubIntegration(connectedProject as any, onUpdateMock));

        await waitFor(() => {
            expect(result.current.state.enabled).toBe(true);
            expect(result.current.state.status).toBe('connected');
            expect(result.current.state.isConnected).toBe(true);
        });
    });

    it('should handle disconnect action', () => {
        const connectedProject = {
            ...mockProject,
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubRootId: 'root-123',
            docHubRootLink: 'Link'
        };
        const { result } = renderHook(() => useDocHubIntegration(connectedProject as any, onUpdateMock));

        act(() => {
            result.current.actions.disconnect();
        });

        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            docHubStatus: 'disconnected',
            docHubRootLink: '',
            docHubRootId: null
        }));
    });

    it('should handle connect flow (auth url)', async () => {
        const { result } = renderHook(() => useDocHubIntegration(mockProject as any, onUpdateMock));

        // Set provider/mode first (usually via UI, but here we can simulate or set props)
        // Since hook syncs from props, we might need to update props or use setters if available?
        // Hook has setters!
        act(() => {
            result.current.setters.setProvider('gdrive');
            result.current.setters.setMode('user');
        });

        (invokeAuthedFunction as any).mockResolvedValue({ url: 'https://auth.url' });

        await act(async () => {
            await result.current.actions.connect();
        });

        expect(invokeAuthedFunction).toHaveBeenCalledWith('dochub-auth-url', expect.objectContaining({
            body: expect.objectContaining({ provider: 'gdrive', mode: 'user' })
        }));
        expect(window.location.href).toBe('https://auth.url');
    });

    it('should handle resolveRoot action', async () => {
        const projectWithProvider = {
            ...mockProject,
            docHubProvider: 'gdrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(projectWithProvider as any, onUpdateMock));

        act(() => {
            result.current.setters.setRootLink('https://folder.url');
        });

        (invokeAuthedFunction as any).mockResolvedValue({
            rootName: 'Resolved Folder',
            rootWebUrl: 'https://folder.url',
            rootId: 'f-123'
        });

        await act(async () => {
            await result.current.actions.resolveRoot();
        });

        expect(invokeAuthedFunction).toHaveBeenCalledWith('dochub-resolve-root', expect.anything());
        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            docHubRootName: 'Resolved Folder',
            docHubRootId: 'f-123',
            docHubStatus: 'connected'
        }));
    });

    it('should run auto create pipeline', async () => {
        const connectedProject = {
            ...mockProject,
            id: 'p-1',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubRootId: 'root-123',
            docHubRootLink: 'Link',
            docHubProvider: 'gdrive'
        };
        const { result } = renderHook(() => useDocHubIntegration(connectedProject as any, onUpdateMock));

        // Mock crypto.randomUUID
        const mockUUID = 'run-uuid';
        Object.defineProperty(global, 'crypto', {
            value: { randomUUID: () => mockUUID },
            writable: true
        });

        // Mock poll response
        const mockChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { status: 'running', progress_percent: 50, logs: ['Log 1'] }
            }),
            then: (resolve: any) => resolve({ data: [], error: null }) // For await ending with limit()
        };
        (supabase.from as any).mockReturnValue(mockChain);

        // Mock trigger
        (invokeAuthedFunction as any).mockResolvedValue({
            createdCount: 5,
            logs: ['Done']
        });

        await act(async () => {
            await result.current.actions.runAutoCreate();
        });

        expect(result.current.state.isAutoCreating).toBe(false);
        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            docHubAutoCreateEnabled: true
        }));
        expect(invokeAuthedFunction).toHaveBeenCalledWith('dochub-autocreate', expect.anything());
    });
});
