import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dbAdapter } from "@infra/db/dbAdapter";
import { PROJECT_SEARCH_KEY } from "@shared/queryKeys/projectKeys";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import type { Project } from "@/types";
import type { ProjectSearchSummary } from "@shared/ui/GlobalSearch/types";

const PAGE_SIZE = 500;
const PROJECT_BATCH_SIZE = 100;
interface SearchCategoryRow {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  work_items?: string[] | null;
}

export const useProjectSearchQuery = ({ userId, projects }: {
  userId?: string;
  projects: Project[];
}) => {
  const [requested, setRequested] = useState(false);
  const requestSearch = useCallback(() => setRequested(true), []);
  const projectIds = projects.map(project => project.id).sort();
  const query = useQuery({
    // Never reuse results across users or a change in the visible project set.
    queryKey: [...PROJECT_SEARCH_KEY, userId, projectIds],
    enabled: !!userId && requested,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Record<string, ProjectSearchSummary>> => {
      const summaries: Record<string, ProjectSearchSummary> = {};
      const databaseIds: string[] = [];
      for (const project of projects) {
        if (projectDemoDataApi.isDemoSession() || projectDemoDataApi.isDemoProjectId(project.id)) {
          summaries[project.id] = projectDemoDataApi.getProjectDetails(project.id);
        } else {
          summaries[project.id] = { title: project.name, location: project.location, categories: [] };
          databaseIds.push(project.id);
        }
      }
      for (let batchStart = 0; batchStart < databaseIds.length; batchStart += PROJECT_BATCH_SIZE) {
        const batch = databaseIds.slice(batchStart, batchStart + PROJECT_BATCH_SIZE);
        const allowedIds = new Set(batch);
        for (let start = 0; ; start += PAGE_SIZE) {
          const { data, error } = await dbAdapter.from("demand_categories")
            .select("id,project_id,title,description,work_items")
            .in("project_id", batch).order("id").range(start, start + PAGE_SIZE - 1);
          if (error) throw error;
          const rows = (data ?? []) as SearchCategoryRow[];
          for (const row of rows) {
            if (!allowedIds.has(row.project_id)) continue;
            summaries[row.project_id].categories.push({
              id: row.id, title: row.title, description: row.description ?? "", workItems: row.work_items ?? [],
            });
          }
          if (rows.length < PAGE_SIZE) break;
        }
      }
      return summaries;
    },
  });
  return { ...query, requestSearch, isSearchLoading: !requested || query.isPending || query.isFetching };
};
