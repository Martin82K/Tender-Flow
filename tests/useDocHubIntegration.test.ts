/**
 * Unit tests for useDocHubIntegration hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocHubIntegration } from '../hooks/useDocHubIntegration';
import { supabase } from '../services/supabase';
import { invokeAuthedFunction } from '../services/functionsClient';
import { storageAdapter } from '../services/platformAdapter';
import { createDocHubProjectMarker } from '@shared/dochub/personalLocation';

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

    it('should not let a shared user disconnect global DocHub settings', async () => {
        const sharedProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubRootId: 'root-123',
            docHubRootLink: 'https://drive.google.com/root',
            docHubProvider: 'gdrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            sharedProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await act(async () => result.current.actions.disconnect());

        expect(result.current.state.canManageGlobal).toBe(false);
        expect(result.current.state.isSharedProject).toBe(true);
        expect(onUpdateMock).not.toHaveBeenCalled();
    });

    it('should reject structure synchronization by a shared user', async () => {
        const sharedProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubRootId: 'root-123',
            docHubRootLink: 'https://drive.google.com/root',
            docHubProvider: 'gdrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            sharedProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await act(async () => result.current.actions.runAutoCreate());

        expect(invokeAuthedFunction).not.toHaveBeenCalledWith('dochub-autocreate', expect.anything());
        expect(result.current.state.modalRequest?.message).toContain('pouze vlastník');
        expect(onUpdateMock).not.toHaveBeenCalled();
    });

    it('should never restore the owner local path for a shared user', async () => {
        const sharedProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'onedrive',
            docHubRootLink: 'C:\\Owner\\Project',
            docHubSettings: {
                onedrive: { rootLink: 'C:\\Owner\\Project', rootName: 'Project' },
            },
        };
        const { result } = renderHook(() => useDocHubIntegration(
            sharedProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await waitFor(() => expect(result.current.state.rootLink).toBe(''));
        expect(result.current.state.isConnected).toBe(false);
    });

    it('should not synthesize cloud folder URLs when the link cache misses', async () => {
        vi.mocked(invokeAuthedFunction).mockRejectedValue(new Error('Folder link not available'));
        const cloudProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'gdrive',
            docHubRootId: 'root-123',
            docHubRootLink: 'https://drive.google.com/drive/folders/root-123',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            cloudProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await waitFor(() => expect(invokeAuthedFunction).toHaveBeenCalled());
        expect(result.current.state.links?.pd).toBeNull();
        expect(result.current.state.links?.tenders).toBeNull();
    });

    it('should preserve successful cloud links when another cache lookup misses', async () => {
        vi.mocked(invokeAuthedFunction).mockImplementation(async (_name, options: any) => {
            if (options.body.kind === 'pd') return { webUrl: 'https://drive.google.com/drive/folders/pd' };
            throw new Error('Folder link not available');
        });
        const cloudProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'gdrive',
            docHubRootId: 'root-123',
            docHubRootLink: 'https://drive.google.com/drive/folders/root-123',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            cloudProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await waitFor(() => expect(result.current.state.links?.pd)
            .toBe('https://drive.google.com/drive/folders/pd'));
        expect(result.current.state.links?.archive).toBeNull();
    });

    it('should preserve a personal path when secure storage deletion fails', async () => {
        const deleteSpy = vi.spyOn(storageAdapter, 'delete').mockRejectedValueOnce(new Error('storage unavailable'));
        const sharedProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'onedrive',
            docHubRootLink: 'C:\\Owner\\Project',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            sharedProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));
        act(() => result.current.setters.setRootLink('D:\\Shared\\Project'));

        await act(async () => result.current.actions.disconnect());

        expect(result.current.state.rootLink).toBe('D:\\Shared\\Project');
        expect(result.current.state.modalRequest?.variant).toBe('danger');
        deleteSpy.mockRestore();
    });

    it('should reject the browser folder fallback for a shared user', async () => {
        const picker = vi.fn().mockResolvedValue({ name: 'Shared Project' });
        Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: picker });
        const sharedProject = {
            ...mockProject,
            id: 'shared-project',
            ownerId: 'owner-user',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'onedrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(
            sharedProject as any,
            onUpdateMock,
            { userId: 'shared-user' },
        ));

        await act(async () => result.current.actions.pickLocalFolder());

        expect(picker).not.toHaveBeenCalled();
        expect(onUpdateMock).not.toHaveBeenCalled();
        expect(result.current.state.modalRequest?.message).toContain('desktopové aplikaci');
        delete (window as any).showDirectoryPicker;
    });

    it('should preserve manual local-path setup for a project owner in the web app', async () => {
        const ownerProject = {
            ...mockProject,
            id: 'owner-project',
            docHubProvider: 'onedrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(ownerProject as any, onUpdateMock));

        act(() => result.current.setters.setRootLink('C:\\Shared\\Owner Project'));
        await act(async () => result.current.actions.resolveRoot());

        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            docHubProvider: 'onedrive',
            docHubRootLink: 'C:\\Shared\\Owner Project',
            docHubStatus: 'connected',
        }));
        expect(result.current.state.modalRequest?.message).toContain('Desktop');
    });

    it('should create a project marker when an owner selects a local folder in the web app', async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        const close = vi.fn().mockResolvedValue(undefined);
        const getFileHandle = vi.fn()
            .mockRejectedValueOnce(new DOMException('Missing marker', 'NotFoundError'))
            .mockResolvedValueOnce({
                createWritable: vi.fn().mockResolvedValue({ write, close }),
            });
        const picker = vi.fn().mockResolvedValue({ name: 'Owner Project', getFileHandle });
        Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: picker });
        const ownerProject = {
            ...mockProject,
            id: 'owner-project',
            docHubProvider: 'onedrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(ownerProject as any, onUpdateMock));

        await act(async () => result.current.actions.pickLocalFolder());

        expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
        expect(getFileHandle).toHaveBeenCalledWith('.tenderflow-project.json', { create: true });
        expect(write).toHaveBeenCalledWith(expect.stringContaining('owner-project'));
        expect(close).toHaveBeenCalled();
        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            docHubRootLink: 'Owner Project',
            docHubStatus: 'connected',
        }));
        delete (window as any).showDirectoryPicker;
    });

    it('should not overwrite a web marker that belongs to another project', async () => {
        const createWritable = vi.fn();
        const getFileHandle = vi.fn().mockResolvedValue({
            getFile: vi.fn().mockResolvedValue({
                text: vi.fn().mockResolvedValue(createDocHubProjectMarker('other-project')),
            }),
            createWritable,
        });
        const picker = vi.fn().mockResolvedValue({ name: 'Other Project', getFileHandle });
        Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: picker });
        const ownerProject = {
            ...mockProject,
            id: 'owner-project',
            docHubProvider: 'onedrive',
        };
        const { result } = renderHook(() => useDocHubIntegration(ownerProject as any, onUpdateMock));

        await act(async () => result.current.actions.pickLocalFolder());

        expect(createWritable).not.toHaveBeenCalled();
        expect(onUpdateMock).not.toHaveBeenCalled();
        expect(result.current.state.modalRequest?.message).toContain('jiným projektem');
        delete (window as any).showDirectoryPicker;
    });

    it('should save only the normalized online URL from the dedicated action', async () => {
        const ownerProject = {
            ...mockProject,
            id: 'owner-project',
            docHubEnabled: true,
            docHubStatus: 'connected',
            docHubProvider: 'onedrive',
            docHubRootLink: 'C:\\Owner\\Project',
            docHubRootId: 'local:C:\\Owner\\Project',
        };
        const { result } = renderHook(() => useDocHubIntegration(ownerProject as any, onUpdateMock));

        act(() => {
            result.current.setters.setRootLink('C:\\Unverified\\Other Project');
            result.current.setters.setOnlineRootLinkDraft('https://drive.google.com/drive/folders/shared');
        });
        await act(async () => result.current.actions.saveOnlineLink());

        expect(onUpdateMock).toHaveBeenCalledWith({
            docHubRootWebUrl: 'https://drive.google.com/drive/folders/shared',
        });
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

        (invokeAuthedFunction as any).mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/auth?client_id=test' });

        await act(async () => {
            await result.current.actions.connect();
        });

        expect(invokeAuthedFunction).toHaveBeenCalledWith('dochub-auth-url', expect.objectContaining({
            body: expect.objectContaining({ provider: 'gdrive', mode: 'user' })
        }));
        expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/auth?client_id=test');
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
