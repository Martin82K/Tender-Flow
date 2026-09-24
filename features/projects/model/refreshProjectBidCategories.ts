import type { QueryClient } from "@tanstack/react-query";
import { dbAdapter } from "@infra/db/dbAdapter";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { fetchProjectBids } from "@features/projects/api/projectBidsApi";
import type { ProjectDetails } from "@/types";

/** Refresh a category snapshot, preserving metadata and newer local writes. */
export const refreshProjectBidCategories = async (
  client: QueryClient,
  projectId: string,
  categoryIds: string[],
  signal: AbortSignal,
): Promise<"applied" | "retry" | "full" | "skipped"> => {
  const queryKey = PROJECT_DETAILS_KEYS.detail(projectId);
  const query = client.getQueryCache().find({ queryKey, exact: true });
  const before = client.getQueryData<ProjectDetails | null>(queryKey);
  if (!query || !before || signal.aborted) return "skipped";
  if (query.state.fetchStatus !== "idle") return "retry";
  const updateCount = query.state.dataUpdateCount;
  const ids = [...new Set(categoryIds)].filter(id => before.categories.some(category => category.id === id));
  if (ids.length === 0) return "skipped";

  // The project check also detects full access revocation. Bid SELECT retains all
  // existing RLS/module/subscription checks; no event payload is trusted as data.
  const [project, visibleCategories, bidResult] = await Promise.all([
    dbAdapter.from("projects").select("id").eq("id", projectId).abortSignal(signal).maybeSingle(),
    dbAdapter.from("demand_categories").select("id").eq("project_id", projectId).in("id", ids).abortSignal(signal),
    fetchProjectBids(ids, signal).then(data => ({ data, error: null }), (error: unknown) => ({ data: null, error })),
  ]);
  if (signal.aborted || client.getQueryCache().find({ queryKey, exact: true }) !== query) return "skipped";
  if (project.error) throw project.error;
  if (!project.data) {
    // Cancel an older full snapshot before recording a confirmed denial.
    await client.cancelQueries({ queryKey, exact: true });
    if (!signal.aborted && client.getQueryCache().find({ queryKey, exact: true }) === query) client.setQueryData(queryKey, null);
    return "applied";
  }
  if (visibleCategories.error) throw visibleCategories.error;
  // Missing category/module access invalidates the complete snapshot so other
  // cached categories cannot retain data from a revoked pipeline permission.
  if (visibleCategories.data?.length !== ids.length) return "full";
  if (bidResult.error) throw bidResult.error;
  if (query.state.fetchStatus !== "idle" || query.state.dataUpdateCount !== updateCount) return "retry";
  client.setQueryData<ProjectDetails | null>(queryKey, current => {
    if (current !== before) return current;
    const nextBids = { ...current.bids };
    for (const id of ids) nextBids[id] = bidResult.data?.[id] || [];
    return {
      ...current,
      bids: nextBids,
      categories: current.categories.map(category => ids.includes(category.id)
        ? { ...category, subcontractorCount: nextBids[category.id].length }
        : category),
    };
  }, { updatedAt: query.state.dataUpdatedAt }); // A bid refresh does not make metadata fresh.
  return "applied";
};
