import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDocHubProjectMarker } from "@shared/dochub/personalLocation";
import type { ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
  folderExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("../services/platformAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/platformAdapter")>();
  return {
    ...actual,
    isDesktop: true,
    storageAdapter: {
      ...actual.storageAdapter,
      get: mocks.storageGet,
      set: mocks.storageSet,
    },
    fileSystemAdapter: {
      ...actual.fileSystemAdapter,
      folderExists: mocks.folderExists,
      readFile: mocks.readFile,
      writeFile: mocks.writeFile,
      grantAccess: vi.fn().mockResolvedValue(true),
    },
  };
});

vi.mock("../services/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock("../services/functionsClient", () => ({ invokeAuthedFunction: vi.fn() }));

import { useDocHubIntegration } from "../hooks/useDocHubIntegration";

const project = (id: string, ownerId = "owner-1"): ProjectDetails => ({
  id,
  ownerId,
  title: id,
  categories: [],
  docHubEnabled: true,
  docHubStatus: "connected",
  docHubProvider: "onedrive",
  docHubRootLink: `C:\\Owner\\${id}`,
  docHubRootId: `local:C:\\Owner\\${id}`,
});

describe("useDocHubIntegration project identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderExists.mockResolvedValue(true);
    mocks.readFile.mockImplementation(async (markerPath: string) => new TextEncoder().encode(
      createDocHubProjectMarker(markerPath.includes("project-2") ? "project-2" : "project-1"),
    ));
  });

  it("hides the previous personal root synchronously while a new project is loading", async () => {
    let resolveSecond: ((value: string) => void) | undefined;
    const pendingSecond = new Promise<string>((resolve) => { resolveSecond = resolve; });
    mocks.storageGet.mockImplementation((key: string) => {
      const projectId = key.endsWith(":project-2") ? "project-2" : "project-1";
      if (projectId === "project-2") return pendingSecond;
      return Promise.resolve(JSON.stringify({
        version: 1,
        userId: "shared-1",
        projectId,
        rootPath: `D:\\Shared\\${projectId}`,
        rootName: projectId,
        savedAt: "2026-08-07T12:00:00.000Z",
      }));
    });

    const { result, rerender } = renderHook(
      ({ currentProject }) => useDocHubIntegration(currentProject, vi.fn(), { userId: "shared-1" }),
      { initialProps: { currentProject: project("project-1") } },
    );
    await waitFor(() => expect(result.current.state.rootLink).toBe("D:\\Shared\\project-1"));

    rerender({ currentProject: project("project-2") });
    expect(result.current.state.rootLink).toBe("");
    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.hasPersonalLocalRoot).toBe(false);

    resolveSecond?.(JSON.stringify({
      version: 1,
      userId: "shared-1",
      projectId: "project-2",
      rootPath: "D:\\Shared\\project-2",
      rootName: "project-2",
      savedAt: "2026-08-07T12:05:00.000Z",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("D:\\Shared\\project-2"));
  });

  it("validates the online URL before writing a desktop personal mapping", async () => {
    mocks.storageGet.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    act(() => {
      result.current.setters.setRootLink("C:\\Owner\\new-root");
      result.current.setters.setOnlineRootLinkDraft("http://invalid.example.com");
    });
    await act(async () => result.current.actions.resolveRoot());

    expect(mocks.storageSet).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
