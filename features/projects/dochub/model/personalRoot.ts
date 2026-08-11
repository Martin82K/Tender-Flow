import { useEffect, useRef, useState } from "react";

import { fileSystemAdapter, isDesktop, storageAdapter } from "@infra/platform/platformAdapter";
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
  if (!parsed) {
    return { location: null, hadStoredLocation: !isProjectOwner(project, userId) };
  }
  const location = await validateDocHubPersonalLocation(parsed, project.id, project.docHubRootId, {
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
  if (!isDesktop) {
    return isProjectOwner(project, userId) ? project.docHubRootLink?.trim() || "" : "";
  }

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
    project.docHubRootId ?? null,
    userId,
  ]);
  const initialRoot = project.docHubProvider === "onedrive"
    ? ""
    : project.docHubRootLink?.trim() || "";
  const [rootState, setRootState] = useState({
    identity: rootIdentity,
    rootPath: initialRoot,
  });
  const refreshSequenceRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const refreshSequence = ++refreshSequenceRef.current;
      try {
        const nextRoot = await resolveEffectiveProjectDocHubRoot(project, userId);
        if (!cancelled && refreshSequence === refreshSequenceRef.current) {
          setRootState({ identity: rootIdentity, rootPath: nextRoot });
        }
      } catch {
        if (!cancelled && refreshSequence === refreshSequenceRef.current) {
          setRootState({ identity: rootIdentity, rootPath: "" });
        }
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
  }, [project.id, project.ownerId, project.docHubProvider, project.docHubRootLink, project.docHubRootId, rootIdentity, userId]);

  return rootState.identity === rootIdentity ? rootState.rootPath : initialRoot;
};
