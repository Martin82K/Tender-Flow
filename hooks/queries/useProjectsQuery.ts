import { useQuery } from "@tanstack/react-query";
import { dbAdapter } from "../../services/dbAdapter";
import { withRetry, withTimeout } from "../../utils/helpers";
import { useAuth } from "../../context/AuthContext";
import { getDemoData, DEMO_PROJECT } from "../../services/demoData";
import { PROJECT_KEYS } from "@/shared/queryKeys/projectKeys";
import {
    mapVisibleProjects,
    type ProjectVisibilityMetadataRow,
    type ProjectVisibilityRow,
} from "@features/projects/model/projectVisibility";

export { PROJECT_KEYS } from "@/shared/queryKeys/projectKeys";

export const useProjectsQuery = () => {
    const { user } = useAuth();

    return useQuery({
        queryKey: [...PROJECT_KEYS.list(), user?.id],
        enabled: !!user,
        queryFn: async () => {

            if (user?.role === "demo") {
                const demoData = getDemoData();
                return (demoData && demoData.projects && demoData.projects.length > 0)
                    ? demoData.projects
                    : [DEMO_PROJECT];
            }

            const [projectsResponse, metadataResponse] = await Promise.all([
                // ... rest of logic ...
                withRetry(
                    () =>
                        withTimeout(
                            Promise.resolve(
                                dbAdapter.from("projects").select("*").order("created_at", { ascending: false })
                            ),
                            12000,
                            "Načtení projektů vypršelo"
                        ),
                    { retries: 1 }
                ),
                withRetry(
                    () =>
                        withTimeout(
                            Promise.resolve(dbAdapter.rpc("get_projects_metadata")),
                            12000,
                            "Načtení oprávnění vypršelo"
                        ),
                    { retries: 1 }
                ),
            ]);

            if (projectsResponse.error) throw projectsResponse.error;

            return mapVisibleProjects(
                (projectsResponse.data || []) as ProjectVisibilityRow[],
                (metadataResponse.data || []) as ProjectVisibilityMetadataRow[],
                {
                    userId: user?.id,
                    userEmail: user?.email,
                }
            );
        },
        staleTime: 5 * 60 * 1000,
    });
};
