import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/supabase";
import { withRetry, withTimeout } from "../../utils/helpers";
import { Project } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { getDemoData, DEMO_PROJECT } from "../../services/demoData";

export const PROJECT_KEYS = {
    all: ["projects"] as const,
    list: () => [...PROJECT_KEYS.all, "list"] as const,
    details: () => [...PROJECT_KEYS.all, "details"] as const,
    detail: (id: string) => [...PROJECT_KEYS.details(), id] as const,
};

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
                                supabase.from("projects").select("*").order("created_at", { ascending: false })
                            ),
                            12000,
                            "Načtení projektů vypršelo"
                        ),
                    { retries: 1 }
                ),
                withRetry(
                    () =>
                        withTimeout(
                            Promise.resolve(supabase.rpc("get_projects_metadata")),
                            12000,
                            "Načtení oprávnění vypršelo"
                        ),
                    { retries: 1 }
                ),
            ]);

            if (projectsResponse.error) throw projectsResponse.error;

            const projectsData = (projectsResponse.data || []) as any[];
            const metadata =
                (metadataResponse.data as { project_id: string; owner_email: string; shared_with_emails: string[] }[]) ||
                [];

            const metadataMap = new Map<string, { owner: string; shared: string[] }>();
            metadata.forEach((m) => metadataMap.set(m.project_id, { owner: m.owner_email, shared: m.shared_with_emails || [] }));

            const loadedProjects: Project[] = projectsData.map((p) => {
                const meta = metadataMap.get(p.id);
                return {
                    id: p.id,
                    name: p.name,
                    location: p.location || "",
                    status: p.status || "realization",
                    isDemo: p.is_demo,
                    ownerId: p.owner_id,
                    ownerEmail: meta?.owner,
                    sharedWith: meta?.shared,
                };
            });

            return loadedProjects;
        },
        staleTime: 5 * 60 * 1000,
    });
};
