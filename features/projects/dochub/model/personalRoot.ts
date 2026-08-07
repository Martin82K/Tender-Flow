import { useEffect, useState } from "react";

import { fileSystemAdapter, isDesktop, storageAdapter } from "@/services/platformAdapter";
import type { ProjectDetails } from "@/types";
import {
  buildDocHubPersonalLocationKey,
  parseDocHubPersonalLocation,
  resolveEffectiveLocalRoot,
  resolveValidatedEffectiveLocalRoot,
  validateDocHubPersonalLocation,
  type DocHubPersonalLocation,
} from "@shared/dochub/personalLocation";

const PERSONAL_ROOT_CHANGED_EVENT = "tenderflow:dochub-personal-root-changed";

const isProjectOwner = (project: ProjectDetails, userId: string | null): boolean =>
  project.ownerId ? project.ownerId === userId : !userId;

interface ProjectDocHubPersonalLocationState {
  location: DocHubPersonalLocation | null;
  hadStoredLocation: boolean;
}

export const loadProjectDocHubPersonalLocationState = async (
  project: ProjectDetails,
  userId: string | null,
): Promise<ProjectDocHubPersonalLocationState> => {
  if (!isDesktop || project.docHubProvider !== "onedrive" || !project.id || !userId) {
    return { location: null, hadStoredLocation: false };
  }

  const serialized = await storageAdapter.get(buildDocHubPersonalLocationKey(userId, project.id));
  if (!serialized) return { location: null, hadStoredLocation: false };
  const parsed = parseDocHubPersonalLocation(serialized, userId, project.id);
  const location = await validateDocHubPersonalLocation(parsed, project.id, {
    folderExists: (rootPath) => fileSystemAdapter.folderExists(rootPath),
    readMarker: async (markerPath) => {
      const bytes = await fileSystemAdapter.readFile(markerPath, { maxBytes: 64 * 1024 });
      return new TextDecoder().decode(bytes);
    },
  });
  return { location, hadStoredLocation: true };
};

export const resolveEffectiveProjectDocHubRoot = async (
  project: ProjectDetails,
  userId: string | null,
): Promise<string> => {
  if (project.docHubProvider !== "onedrive") return project.docHubRootLink?.trim() || "";
  if (!isDesktop) return "";

  try {
    const personalState = await loadProjectDocHubPersonalLocationState(project, userId);
    return resolveValidatedEffectiveLocalRoot({
      isProjectOwner: isProjectOwner(project, userId),
      projectRootPath: project.docHubRootLink,
      personalRootPath: personalState.location?.rootPath,
      hadStoredLocation: personalState.hadStoredLocation,
    });
  } catch {
    return "";
  }
};

export const notifyProjectDocHubPersonalRootChanged = (
  projectId: string,
  userId: string,
): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PERSONAL_ROOT_CHANGED_EVENT, {
    detail: { projectId, userId },
  }));
};

export const useEffectiveProjectDocHubRoot = (
  project: ProjectDetails,
  userId: string | null,
): string => {
  const rootIdentity = JSON.stringify([
    project.id ?? null,
    project.ownerId ?? null,
    project.docHubProvider ?? null,
    project.docHubRootLink ?? null,
    userId,
  ]);
  const initialRoot = project.docHubProvider === "onedrive"
    ? ""
    : project.docHubRootLink?.trim() || "";
  const [rootState, setRootState] = useState({
    identity: rootIdentity,
    rootPath: initialRoot,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const nextRoot = await resolveEffectiveProjectDocHubRoot(project, userId);
        if (!cancelled) setRootState({ identity: rootIdentity, rootPath: nextRoot });
      } catch {
        if (!cancelled) setRootState({ identity: rootIdentity, rootPath: "" });
      }
    };
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; userId?: string }>).detail;
      if (detail?.projectId === project.id && detail.userId === userId) void refresh();
    };

    void refresh();
    window.addEventListener(PERSONAL_ROOT_CHANGED_EVENT, handleChange);
    return () => {
      cancelled = true;
      window.removeEventListener(PERSONAL_ROOT_CHANGED_EVENT, handleChange);
    };
  }, [project.id, project.ownerId, project.docHubProvider, project.docHubRootLink, rootIdentity, userId]);

  return rootState.identity === rootIdentity ? rootState.rootPath : initialRoot;
};
