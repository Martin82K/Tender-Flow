import { useEffect, useRef } from "react";
import { navigate } from "@/shared/routing/router";
import { parseAppRoute } from "@/shared/routing/routeUtils";
import { View } from "@/types";

interface UseRouteStateSyncParams {
  isAuthenticated: boolean;
  pathname: string;
  search: string;
  selectedProjectId: string | null;
  activePipelineCategoryId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  setCurrentView: (view: View) => void;
  setActiveProjectTab: (tab: string) => void;
  setActivePipelineCategoryId: (categoryId: string | null) => void;
}

export const useRouteStateSync = ({
  isAuthenticated,
  pathname,
  search,
  selectedProjectId,
  activePipelineCategoryId,
  setSelectedProjectId,
  setCurrentView,
  setActiveProjectTab,
  setActivePipelineCategoryId,
}: UseRouteStateSyncParams): void => {
  const lastNavigationRef = useRef<{ pathname: string; search: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (
      lastNavigationRef.current?.pathname === pathname &&
      lastNavigationRef.current?.search === search
    ) {
      return;
    }
    lastNavigationRef.current = { pathname, search };

    const route = parseAppRoute(pathname, search);
    if (!route.isApp) return;

    if ("redirectTo" in route) {
      navigate(route.redirectTo, { replace: true });
      return;
    }

    setCurrentView(route.view);
    if (route.view === "project") {
      if (route.projectId && route.projectId !== selectedProjectId) {
        setSelectedProjectId(route.projectId);
      }
      if (route.tab) {
        setActiveProjectTab(route.tab);
      }
      setActivePipelineCategoryId(route.categoryId ?? null);
      return;
    }

    if (activePipelineCategoryId) {
      setActivePipelineCategoryId(null);
    }
  }, [
    pathname,
    search,
    isAuthenticated,
    selectedProjectId,
    activePipelineCategoryId,
    setSelectedProjectId,
    setCurrentView,
    setActiveProjectTab,
    setActivePipelineCategoryId,
  ]);
};
