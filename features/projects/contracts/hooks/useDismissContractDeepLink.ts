import { useCallback } from 'react';
import { navigate, useLocation } from '@shared/routing/router';
import { buildAppUrl, parseAppRoute } from '@shared/routing/routeUtils';

/** Consume a linked selection only after explicit user navigation, preserving other query parameters. */
export const useDismissContractDeepLink = (projectId: string, contractId?: string) => {
  const { pathname, search } = useLocation();
  return useCallback(() => {
    if (!contractId) return;
    const route = parseAppRoute(pathname, search);
    if (!route.isApp || !('view' in route) || route.view !== 'project'
      || route.projectId !== projectId || route.contractId !== contractId) return;
    const params = new URLSearchParams(search);
    params.delete('contractId');
    const query = params.toString();
    navigate(`${buildAppUrl('project', { projectId })}${query ? `?${query}` : ''}`, { replace: true });
  }, [projectId, contractId, pathname, search]);
};
