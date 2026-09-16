import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteStateSync } from '@app/hooks/useRouteStateSync';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/shared/routing/router', () => ({ navigate }));
const params = (pathname: string, isAuthenticated = true) => ({
  pathname, search: '', isAuthenticated,
  selectedProjectId: null, activePipelineCategoryId: null, activeContractId: null,
  setSelectedProjectId: vi.fn(), setCurrentView: vi.fn(), setActiveProjectTab: vi.fn(),
  setActivePipelineCategoryId: vi.fn(), setActiveContractId: vi.fn(),
});

describe('authenticated startup', () => {
  beforeEach(() => vi.clearAllMocks());
  it('opens all projects from the desktop root with a restored session', () => {
    renderHook(() => useRouteStateSync(params('/')));
    expect(navigate).toHaveBeenCalledWith('/app/projects?status=all', { replace: true });
  });
  it('keeps the public root before authentication', () => {
    renderHook(() => useRouteStateSync(params('/', false)));
    expect(navigate).not.toHaveBeenCalled();
  });
  it.each(['/app/todo', '/app/project/project-1', '/oauth/consent', '/login'])('preserves explicit destination %s', (pathname) => {
    renderHook(() => useRouteStateSync(params(pathname)));
    expect(navigate).not.toHaveBeenCalled();
  });
});
