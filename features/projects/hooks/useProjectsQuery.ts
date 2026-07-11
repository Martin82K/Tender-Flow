import { useQuery } from "@tanstack/react-query";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import {
  mapVisibleProjects,
  type ProjectVisibilityMetadataRow,
  type ProjectVisibilityRow,
} from "@features/projects/model/projectVisibility";
import { dbAdapter } from "@infra/db/dbAdapter";
import { PROJECT_KEYS } from "@shared/queryKeys/projectKeys";
import { withRetry, withTimeout } from "@shared/async/asyncControl";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";

export { PROJECT_KEYS } from "@shared/queryKeys/projectKeys";

interface UseProjectsQueryInput {
  user: AuthIdentity | null;
}

export const useProjectsQuery = ({ user }: UseProjectsQueryInput) => {
  return useQuery({
    queryKey: [...PROJECT_KEYS.list(), user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      if (user?.role === "demo") {
        return projectDemoDataApi.getProjects();
      }

      const [projectsResponse, metadataResponse] = await Promise.all([
        withRetry(
          () =>
            withTimeout(
              Promise.resolve(
                dbAdapter
                  .from("projects")
                  .select("*")
                  .order("created_at", { ascending: false }),
              ),
              12000,
              "Načtení projektů vypršelo",
            ),
          { retries: 1 },
        ),
        withRetry(
          () =>
            withTimeout(
              Promise.resolve(dbAdapter.rpc("get_projects_metadata")),
              12000,
              "Načtení oprávnění vypršelo",
            ),
          { retries: 1 },
        ),
      ]);

      if (projectsResponse.error) throw projectsResponse.error;

      return mapVisibleProjects(
        (projectsResponse.data || []) as ProjectVisibilityRow[],
        (metadataResponse.data || []) as ProjectVisibilityMetadataRow[],
        {
          userId: user?.id,
          userEmail: user?.email,
        },
      );
    },
    staleTime: 5 * 60 * 1000,
  });
};
