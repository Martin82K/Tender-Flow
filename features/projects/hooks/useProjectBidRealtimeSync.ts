import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ProjectDetails } from "@/types";
import { projectBidRealtimeApi } from "../api/projectBidRealtimeApi";
import { PROJECT_DETAILS_KEYS } from "./useProjectDetailsQuery";

const BACKGROUND_REFRESH_INTERVAL_MS = 60_000;

interface UseProjectBidRealtimeSyncOptions {
  allProjectDetails: Record<string, ProjectDetails>;
  selectedProjectId: string | null;
  enabled?: boolean;
}

export const useProjectBidRealtimeSync = ({
  allProjectDetails,
  selectedProjectId,
  enabled = true,
}: UseProjectBidRealtimeSyncOptions): void => {
  const queryClient = useQueryClient();
  const projectDetailsRef = useRef(allProjectDetails);
  const selectedProjectIdRef = useRef(selectedProjectId);

  projectDetailsRef.current = allProjectDetails;
  selectedProjectIdRef.current = selectedProjectId;

  const refreshProject = useCallback(
    (projectId: string) => {
      void queryClient.invalidateQueries({
        queryKey: PROJECT_DETAILS_KEYS.detail(projectId),
        exact: true,
        refetchType: "active",
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!enabled) return;

    return projectBidRealtimeApi.subscribeToBidUpdates({
      onBidUpdated: (demandCategoryId) => {
        const matchingProject = demandCategoryId
          ? Object.values(projectDetailsRef.current).find((project) =>
              project.categories.some(
                (category) => category.id === demandCategoryId,
              ),
            )
          : undefined;
        const projectId = matchingProject?.id ?? selectedProjectIdRef.current;
        if (projectId) refreshProject(projectId);
      },
      onSubscriptionError: () => {
        const projectId = selectedProjectIdRef.current;
        if (projectId) refreshProject(projectId);
      },
    });
  }, [enabled, refreshProject]);

  useEffect(() => {
    if (!enabled || !selectedProjectId) return;

    const intervalId = window.setInterval(() => {
      refreshProject(selectedProjectId);
    }, BACKGROUND_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, refreshProject, selectedProjectId]);
};
