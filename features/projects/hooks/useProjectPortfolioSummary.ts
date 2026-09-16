import { useQuery } from '@tanstack/react-query';
import type { Project } from '@/types';
import { fetchProjectPortfolioSummary } from '@features/projects/api/projectOverviewSummaryApi';

export function useProjectPortfolioSummary(projects: Project[], userId?: string, organizationId?: string) {
  const ids = projects.filter(project => project.status !== 'archived' && !project.isDemo).map(project => project.id).sort();
  return useQuery({
    queryKey: ['projectPortfolioSummary', userId, organizationId, ids],
    queryFn: () => fetchProjectPortfolioSummary(ids),
    enabled: Boolean(userId) && ids.length > 0,
    staleTime: 60_000,
  });
}
