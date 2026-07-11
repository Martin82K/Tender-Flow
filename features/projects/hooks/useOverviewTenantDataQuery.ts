import { useQuery } from "@tanstack/react-query";

import { dbAdapter } from "@infra/db/dbAdapter";
import { normalizeOverviewTenantData } from "@features/projects/model/overviewTenantData";

export type { OverviewTenantData } from "@features/projects/model/overviewTenantData";

export const OVERVIEW_TENANT_DATA_KEY = ["overviewTenantData"] as const;

interface UseOverviewTenantDataQueryInput {
  userId?: string | null;
  isDemoSession: boolean;
}

export const useOverviewTenantDataQuery = ({
  userId,
  isDemoSession,
}: UseOverviewTenantDataQueryInput) =>
  useQuery({
    queryKey: [...OVERVIEW_TENANT_DATA_KEY, userId ?? null],
    enabled: Boolean(userId) && !isDemoSession,
    queryFn: async () => {
      const { data, error } = await dbAdapter.rpc<unknown>(
        "get_overview_tenant_data",
      );
      if (error) throw error;
      return normalizeOverviewTenantData(data);
    },
    staleTime: 2 * 60 * 1000,
  });
