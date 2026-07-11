import { useAuth } from "@/context/AuthContext";
import { isDemoSession } from "@/services/demoData";
import {
  useOverviewTenantDataQuery as useFeatureOverviewTenantDataQuery,
} from "@features/projects/hooks/useOverviewTenantDataQuery";

export {
  OVERVIEW_TENANT_DATA_KEY,
  type OverviewTenantData,
} from "@features/projects/hooks/useOverviewTenantDataQuery";

export const useOverviewTenantDataQuery = () => {
  const { user } = useAuth();

  return useFeatureOverviewTenantDataQuery({
    userId: user?.id,
    isDemoSession: isDemoSession(),
  });
};
