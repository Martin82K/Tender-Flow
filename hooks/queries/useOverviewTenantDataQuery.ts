import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/supabase";
import { isDemoSession } from "../../services/demoData";
import type { Project, ProjectDetails } from "../../types";

export interface OverviewTenantData {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails>;
}

const normalizeOverviewTenantData = (payload: any): OverviewTenantData => {
  if (!payload || typeof payload !== "object") {
    return { projects: [], projectDetails: {} };
  }

  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const projectDetails = payload.projectDetails && typeof payload.projectDetails === "object"
    ? payload.projectDetails
    : {};

  return {
    projects,
    projectDetails,
  };
};

export const OVERVIEW_TENANT_DATA_KEY = ["overviewTenantData"] as const;

export const useOverviewTenantDataQuery = () => {
  return useQuery({
    queryKey: OVERVIEW_TENANT_DATA_KEY,
    enabled: !isDemoSession(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_overview_tenant_data");
      if (error) throw error;
      return normalizeOverviewTenantData(data);
    },
    staleTime: 2 * 60 * 1000,
  });
};
