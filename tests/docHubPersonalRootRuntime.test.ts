import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { createDocHubProjectMarker } from "@shared/dochub/personalLocation";
import type { ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  storageGet: vi.fn(),
  folderExists: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/services/platformAdapter", () => ({
  isDesktop: true,
  storageAdapter: { get: mocks.storageGet },
  fileSystemAdapter: {
    folderExists: mocks.folderExists,
    readFile: mocks.readFile,
  },
}));

import {
  resolveEffectiveProjectDocHubRoot,
  notifyProjectDocHubPersonalRootChanged,
  useEffectiveProjectDocHubRoot,
} from "@features/projects/dochub/model/personalRoot";

const project = {
  id: "project-1",
  ownerId: "owner-1",
  title: "Projekt",
  categories: [],
  docHubProvider: "onedrive",
  docHubRootLink: "C:\\Owner\\Project",
  docHubRootId: "root-generation-1",
} as ProjectDetails;

describe("DocHub effective personal root", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderExists.mockResolvedValue(true);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(createDocHubProjectMarker("project-1", "root-generation-1")));
  });

  it("uses the validated personal root for a shared user", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      userId: "shared-1",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "D:\\Shared\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));

    await expect(resolveEffectiveProjectDocHubRoot(project, "shared-1"))
      .resolves.toBe("D:\\Shared\\Project");
  });

  it("rejects a formerly valid shared root after the owner changes the connection", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      userId: "shared-1",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "D:\\Shared\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(
      createDocHubProjectMarker("project-1", "root-generation-1"),
    ));

    await expect(resolveEffectiveProjectDocHubRoot({
      ...project,
      docHubRootId: "root-generation-2",
    }, "shared-1")).resolves.toBe("");
  });

  it("fails closed for a shared user's legacy mapping without a connection generation", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 1,
      userId: "shared-1",
      projectId: "project-1",
      rootPath: "D:\\Shared\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));

    await expect(resolveEffectiveProjectDocHubRoot(project, "shared-1")).resolves.toBe("");
  });

  it("lets the owner reconnect a legacy mapping so its marker can be upgraded", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 1,
      userId: "owner-1",
      projectId: "project-1",
      rootPath: "C:\\Owner\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));

    await expect(resolveEffectiveProjectDocHubRoot(project, "owner-1"))
      .resolves.toBe("C:\\Owner\\Project");
  });

  it("fails closed when a stored marker belongs to another project", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "C:\\Owner\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(createDocHubProjectMarker("project-2", "root-generation-1")));

    await expect(resolveEffectiveProjectDocHubRoot(project, "owner-1")).resolves.toBe("");
  });

  it("keeps the owner legacy root only when no personal mapping was stored", async () => {
    mocks.storageGet.mockResolvedValue(null);

    await expect(resolveEffectiveProjectDocHubRoot(project, "owner-1"))
      .resolves.toBe("C:\\Owner\\Project");
  });

  it("returns an empty root synchronously while a newly selected project is being validated", async () => {
    const secondProject = {
      ...project,
      id: "project-2",
      docHubRootLink: "C:\\Owner\\Project 2",
      docHubRootId: "root-generation-2",
    } as ProjectDetails;
    let resolveSecondLocation: ((value: string) => void) | undefined;
    const secondLocation = new Promise<string>((resolve) => {
      resolveSecondLocation = resolve;
    });
    mocks.storageGet.mockImplementation((key: string) => {
      if (key.endsWith(":project-2")) return secondLocation;
      return Promise.resolve(JSON.stringify({
        version: 2,
        userId: "owner-1",
        projectId: "project-1",
        connectionId: "root-generation-1",
        rootPath: "C:\\Owner\\Project 1",
        rootName: "Project 1",
        savedAt: "2026-08-07T12:00:00.000Z",
      }));
    });
    mocks.readFile.mockImplementation((markerPath: string) => Promise.resolve(
      new TextEncoder().encode(createDocHubProjectMarker(
        markerPath.includes("Project 2") ? "project-2" : "project-1",
        markerPath.includes("Project 2") ? "root-generation-2" : "root-generation-1",
      )),
    ));

    const { result, rerender } = renderHook(
      ({ currentProject }) => useEffectiveProjectDocHubRoot(currentProject, "owner-1"),
      { initialProps: { currentProject: project } },
    );
    await waitFor(() => expect(result.current).toBe("C:\\Owner\\Project 1"));

    rerender({ currentProject: secondProject });
    expect(result.current).toBe("");

    resolveSecondLocation?.(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-2",
      connectionId: "root-generation-2",
      rootPath: "C:\\Owner\\Project 2",
      rootName: "Project 2",
      savedAt: "2026-08-07T12:05:00.000Z",
    }));
    await waitFor(() => expect(result.current).toBe("C:\\Owner\\Project 2"));
  });

  it("ignores an older refresh that finishes after a newer personal-root refresh", async () => {
    let resolveOld: ((value: string) => void) | undefined;
    let resolveNew: ((value: string) => void) | undefined;
    const oldLocation = new Promise<string>((resolve) => { resolveOld = resolve; });
    const newLocation = new Promise<string>((resolve) => { resolveNew = resolve; });
    mocks.storageGet
      .mockReturnValueOnce(oldLocation)
      .mockReturnValueOnce(newLocation);

    const { result } = renderHook(() => useEffectiveProjectDocHubRoot(project, "owner-1"));
    act(() => notifyProjectDocHubPersonalRootChanged("project-1", "owner-1"));

    resolveNew?.(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "C:\\Owner\\New Project",
      rootName: "New Project",
      savedAt: "2026-08-07T12:10:00.000Z",
    }));
    await waitFor(() => expect(result.current).toBe("C:\\Owner\\New Project"));

    resolveOld?.(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "C:\\Owner\\Old Project",
      rootName: "Old Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    await act(async () => { await Promise.resolve(); });

    expect(result.current).toBe("C:\\Owner\\New Project");
  });
});
