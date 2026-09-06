import { useQuery } from "@tanstack/react-query";

import { fetchPersonalProjectOverview } from "@features/projects/api/projectOverviewSummaryApi";
import { dbAdapter } from "@infra/db/dbAdapter";
import { normalizeOverviewTenantData } from "@features/projects/model/overviewTenantData";

export type { OverviewTenantData } from "@features/projects/model/overviewTenantData";

export const OVERVIEW_TENANT_DATA_KEY = ["overviewTenantData"] as const;

interface UseOverviewTenantDataQueryInput {
  userId?: string | null;
  isDemoSession: boolean;
  personalProjectIds?: string[];
}

export const useOverviewTenantDataQuery = ({
  userId,
  isDemoSession,
  personalProjectIds = [],
}: UseOverviewTenantDataQueryInput) =>
  useQuery({
    queryKey: [...OVERVIEW_TENANT_DATA_KEY, userId ?? null, ...(personalProjectIds.length ? [personalProjectIds.slice().sort()] : [])],
    enabled: Boolean(userId) && !isDemoSession,
    queryFn: async () => {
      const [{ data, error }, personal] = await Promise.all([
        dbAdapter.rpc<unknown>("get_overview_tenant_data"),
        fetchPersonalProjectOverview(personalProjectIds),
      ]);
      if (error) throw error;
      const tenant = normalizeOverviewTenantData(data);
      const tenantIds = new Set(tenant.projects.map(project => project.id));
      return {
        projects: [...tenant.projects, ...personal.projects.filter(project => !tenantIds.has(project.id))],
        projectDetails: { ...personal.projectDetails, ...tenant.projectDetails },
      };
    },
    staleTime: 2 * 60 * 1000,
  });
