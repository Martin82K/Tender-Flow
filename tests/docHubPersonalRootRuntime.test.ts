import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

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
  useEffectiveProjectDocHubRoot,
} from "@features/projects/dochub/model/personalRoot";

const project = {
  id: "project-1",
  ownerId: "owner-1",
  title: "Projekt",
  categories: [],
  docHubProvider: "onedrive",
  docHubRootLink: "C:\\Owner\\Project",
} as ProjectDetails;

describe("DocHub effective personal root", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderExists.mockResolvedValue(true);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(createDocHubProjectMarker("project-1")));
  });

  it("uses the validated personal root for a shared user", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 1,
      userId: "shared-1",
      projectId: "project-1",
      rootPath: "D:\\Shared\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));

    await expect(resolveEffectiveProjectDocHubRoot(project, "shared-1"))
      .resolves.toBe("D:\\Shared\\Project");
  });

  it("fails closed when a stored marker belongs to another project", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 1,
      userId: "owner-1",
      projectId: "project-1",
      rootPath: "C:\\Owner\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(createDocHubProjectMarker("project-2")));

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
    } as ProjectDetails;
    let resolveSecondLocation: ((value: string) => void) | undefined;
    const secondLocation = new Promise<string>((resolve) => {
      resolveSecondLocation = resolve;
    });
    mocks.storageGet.mockImplementation((key: string) => {
      if (key.endsWith(":project-2")) return secondLocation;
      return Promise.resolve(JSON.stringify({
        version: 1,
        userId: "owner-1",
        projectId: "project-1",
        rootPath: "C:\\Owner\\Project 1",
        rootName: "Project 1",
        savedAt: "2026-08-07T12:00:00.000Z",
      }));
    });
    mocks.readFile.mockImplementation((markerPath: string) => Promise.resolve(
      new TextEncoder().encode(createDocHubProjectMarker(
        markerPath.includes("Project 2") ? "project-2" : "project-1",
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
      version: 1,
      userId: "owner-1",
      projectId: "project-2",
      rootPath: "C:\\Owner\\Project 2",
      rootName: "Project 2",
      savedAt: "2026-08-07T12:05:00.000Z",
    }));
    await waitFor(() => expect(result.current).toBe("C:\\Owner\\Project 2"));
  });
});
