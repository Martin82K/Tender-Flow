import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ location: { pathname: '/app/project/p1', search: '?tab=contracts&contractId=c1&categoryId=keep&documentsSubTab=dochub' }, navigate: vi.fn() }));
vi.mock('@shared/routing/router', () => ({ useLocation: () => state.location, navigate: state.navigate }));
import { useDismissContractDeepLink } from '@features/projects/contracts/hooks/useDismissContractDeepLink';
beforeEach(() => {
  state.navigate.mockReset();
  state.location = { pathname: '/app/project/p1', search: '?tab=contracts&contractId=c1&categoryId=keep&documentsSubTab=dochub' };
});
it('removes only the matching contract selection while preserving other route parameters', () => {
  const { result } = renderHook(() => useDismissContractDeepLink('p1', 'c1'));
  result.current();
  expect(state.navigate).toHaveBeenCalledWith('/app/project/p1?tab=contracts&categoryId=keep&documentsSubTab=dochub', { replace: true });
});
it.each([['p2', 'c1'], ['p1', 'c2'], ['p1', undefined]])('does not consume another route or selection: %s %s', (projectId, contractId) => {
  const { result } = renderHook(() => useDismissContractDeepLink(projectId!, contractId));
  result.current();
  expect(state.navigate).not.toHaveBeenCalled();
});
