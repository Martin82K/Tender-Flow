import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadSearchContracts, loadSearchTasks } from '../api/extendedSearchApi';
import type { Project } from '@/types';

interface ExtendedSearchInput {
  userId?: string;
  isDemo: boolean;
  projects: Project[];
  tasksEnabled: boolean;
  contractsEnabled: boolean;
}

export const useExtendedSearchQuery = ({ userId, isDemo, projects, tasksEnabled, contractsEnabled }: ExtendedSearchInput) => {
  const queryClient = useQueryClient();
  const [requestedUserId, setRequestedUserId] = useState<string | null>(null);
  useEffect(() => { setRequestedUserId(current => current === userId ? current : null); }, [userId]);
  const requestSearch = useCallback(() => {
    if (!userId || isDemo) return;
    // Some contract forms keep local state. Refresh on opening as well as on mutation invalidation.
    if (tasksEnabled) void queryClient.invalidateQueries({ queryKey: ['tasks', 'search', userId] });
    if (contractsEnabled) void queryClient.invalidateQueries({ queryKey: ['contracts', 'search', userId] });
    setRequestedUserId(userId);
  }, [queryClient, userId, isDemo, tasksEnabled, contractsEnabled]);
  const requested = !!userId && requestedUserId === userId && !isDemo;
  const projectIds = projects.map(project => project.id).sort();
  const tasksActive = requested && tasksEnabled;
  const contractsActive = requested && contractsEnabled;
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'search', userId],
    enabled: tasksActive,
    queryFn: ({ signal }) => loadSearchTasks(userId ?? '', signal),
    staleTime: 60_000,
  });
  const contractsQuery = useQuery({
    queryKey: ['contracts', 'search', userId, projectIds],
    enabled: contractsActive,
    queryFn: ({ signal }) => loadSearchContracts(projectIds, signal),
    staleTime: 60_000,
  });
  const retrySearch = async () => {
    await Promise.all([
      ...(tasksActive && tasksQuery.isError ? [tasksQuery.refetch({ cancelRefetch: false })] : []),
      ...(contractsActive && contractsQuery.isError ? [contractsQuery.refetch({ cancelRefetch: false })] : []),
    ]);
  };
  return {
    tasks: tasksActive ? tasksQuery.data ?? [] : [],
    contracts: contractsActive ? contractsQuery.data ?? [] : [],
    requestSearch,
    isSearchLoading: !!userId && !isDemo && (
      (tasksEnabled && (!requested || tasksQuery.isPending || tasksQuery.isFetching)) ||
      (contractsEnabled && (!requested || contractsQuery.isPending || contractsQuery.isFetching))
    ),
    isError: (tasksActive && tasksQuery.isError) || (contractsActive && contractsQuery.isError),
    retrySearch,
  };
};
