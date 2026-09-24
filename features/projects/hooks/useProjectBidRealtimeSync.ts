import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ProjectDetails } from "@/types";
import { projectBidRealtimeApi } from "../api/projectBidRealtimeApi";
import { notifyProjectBidsPersisted } from "@features/projects/model/projectBidEvents";
import { refreshProjectBidCategories } from "@features/projects/model/refreshProjectBidCategories";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";

const BACKGROUND_REFRESH_INTERVAL_MS = 60_000;
const COALESCE_MS = 250;

interface UseProjectBidRealtimeSyncOptions {
  allProjectDetails: Record<string, ProjectDetails>;
  selectedProjectId: string | null;
  enabled?: boolean;
}

export const useProjectBidRealtimeSync = ({ allProjectDetails, selectedProjectId, enabled = true }: UseProjectBidRealtimeSyncOptions): void => {
  const client = useQueryClient();
  const detailsRef = useRef(allProjectDetails);
  detailsRef.current = allProjectDetails;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const categories = new Set<string>();
    const inactiveProjects = new Set<string>();
    let fullRefresh = false;
    let notify = false;
    let running = false;
    let timer: number | undefined;
    const available = () => document.visibilityState !== "hidden" && navigator.onLine;
    const pending = () => fullRefresh || categories.size > 0 || inactiveProjects.size > 0 || notify;
    const schedule = () => {
      if (controller.signal.aborted || timer !== undefined || running || !available() || !pending()) return;
      timer = window.setTimeout(() => { timer = undefined; void flush(); }, COALESCE_MS);
    };
    const flush = async () => {
      if (controller.signal.aborted || !available() || running) return;
      running = true;
      const full = fullRefresh;
      const ids = [...categories];
      fullRefresh = false;
      categories.clear();
      try {
        if (notify) { notify = false; notifyProjectBidsPersisted(); }
        for (const id of inactiveProjects) {
          void client.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(id), exact: true, refetchType: "none" });
        }
        inactiveProjects.clear();
        if (selectedProjectId && full) {
          // Join any running query instead of repeatedly cancelling its request.
          const queryKey = PROJECT_DETAILS_KEYS.detail(selectedProjectId);
          const alreadyFetching = client.getQueryState(queryKey)?.fetchStatus === "fetching";
          await client.invalidateQueries({ queryKey, exact: true, refetchType: "active" }, { cancelRefetch: false });
          // An event may postdate the running snapshot. Reconcile once after it.
          if (alreadyFetching) fullRefresh = true;
        } else if (selectedProjectId && ids.length) {
          const result = await refreshProjectBidCategories(client, selectedProjectId, ids, controller.signal);
          if (result === "retry") ids.forEach(id => categories.add(id));
          if (result === "full") fullRefresh = true;
        }
      } catch {
        // Route partial refresh errors through the existing query error/retry UX.
        // A failed full refresh waits for the next interval or reconnect.
        if (!full) fullRefresh = true;
      } finally {
        running = false;
        schedule();
      }
    };
    const reconcile = () => {
      if (selectedProjectId) fullRefresh = true;
      schedule();
    };
    const unsubscribe = projectBidRealtimeApi.subscribeToBidUpdates({
      onBidUpdated: categoryId => {
        notify = true;
        const project = categoryId ? Object.values(detailsRef.current).find(item => item.categories.some(category => category.id === categoryId)) : undefined;
        if (project?.id && project.id !== selectedProjectId) inactiveProjects.add(project.id);
        else if (categoryId && project?.id === selectedProjectId) categories.add(categoryId);
        else if (selectedProjectId) fullRefresh = true;
        schedule();
      },
      onSubscriptionError: reconcile,
      onReconnected: reconcile,
    });
    const onVisibility = () => { if (available()) reconcile(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", reconcile);
    // Full reconciliation preserves remote DELETE, category/metadata changes and
    // access revocation detection, including missed realtime events.
    const interval = selectedProjectId ? window.setInterval(() => { if (available()) reconcile(); }, BACKGROUND_REFRESH_INTERVAL_MS) : undefined;
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", reconcile);
      unsubscribe();
    };
  }, [client, enabled, selectedProjectId]);
};
