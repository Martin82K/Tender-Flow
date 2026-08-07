import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDocHubProjectMarker } from "@shared/dochub/personalLocation";
import type { ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
  storageDelete: vi.fn(),
  selectFolder: vi.fn(),
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
      delete: mocks.storageDelete,
    },
    fileSystemAdapter: {
      ...actual.fileSystemAdapter,
      folderExists: mocks.folderExists,
      readFile: mocks.readFile,
      writeFile: mocks.writeFile,
      selectFolder: mocks.selectFolder,
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
  docHubRootId: `connection:${id}`,
});

describe("useDocHubIntegration project identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderExists.mockResolvedValue(true);
    mocks.storageDelete.mockResolvedValue(undefined);
    mocks.readFile.mockImplementation(async (markerPath: string) => new TextEncoder().encode(
      createDocHubProjectMarker(
        markerPath.includes("project-2") ? "project-2" : "project-1",
        markerPath.includes("project-2") ? "connection:project-2" : "connection:project-1",
      ),
    ));
  });

  it("hides the previous personal root synchronously while a new project is loading", async () => {
    let resolveSecond: ((value: string) => void) | undefined;
    const pendingSecond = new Promise<string>((resolve) => { resolveSecond = resolve; });
    mocks.storageGet.mockImplementation((key: string) => {
      const projectId = key.endsWith(":project-2") ? "project-2" : "project-1";
      if (projectId === "project-2") return pendingSecond;
      return Promise.resolve(JSON.stringify({
        version: 2,
        userId: "shared-1",
        projectId,
        connectionId: `connection:${projectId}`,
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
      version: 2,
      userId: "shared-1",
      projectId: "project-2",
      connectionId: "connection:project-2",
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

  it("does not let an older personal-root load overwrite a newly saved root", async () => {
    let resolveOld: ((value: string) => void) | undefined;
    mocks.storageGet.mockReturnValueOnce(new Promise<string>((resolve) => { resolveOld = resolve; }));
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(createDocHubProjectMarker("project-1", "connection:project-1")));
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), vi.fn(), {
      userId: "shared-1",
    }));

    act(() => result.current.setters.setRootLink("D:\\Shared\\New Project"));
    await act(async () => result.current.actions.resolveRoot());
    expect(result.current.state.rootLink).toBe("D:\\Shared\\New Project");

    resolveOld?.(JSON.stringify({
      version: 2,
      userId: "shared-1",
      projectId: "project-1",
      connectionId: "connection:project-1",
      rootPath: "D:\\Shared\\Old Project",
      rootName: "Old Project",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    await waitFor(() => expect(mocks.readFile).toHaveBeenCalled());

    expect(result.current.state.rootLink).toBe("D:\\Shared\\New Project");
  });

  it("does not persist an owner's personal root when the global update fails", async () => {
    mocks.storageGet.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Owner\\New Project", name: "New Project" });
    const onUpdate = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    await act(async () => result.current.actions.pickLocalFolder());

    expect(onUpdate).toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.storageSet).not.toHaveBeenCalled();
    expect(result.current.state.modalRequest?.message).toContain("network unavailable");
  });

  it("zachová cloudové připojení při následném připojení lokální složky", async () => {
    mocks.storageGet.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Google Drive\\Project", name: "Project" });
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const cloudProject: ProjectDetails = {
      ...project("project-1"),
      docHubProvider: "gdrive",
      docHubRootLink: "https://drive.google.com/drive/folders/cloud-root",
      docHubRootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
      docHubRootId: "cloud-root",
    };
    const { result } = renderHook(() => useDocHubIntegration(cloudProject, onUpdate, {
      userId: "owner-1",
    }));

    act(() => result.current.setters.setProvider("onedrive"));
    await waitFor(() => expect(result.current.state.provider).toBe("onedrive"));
    await act(async () => result.current.actions.pickLocalFolder());

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      docHubProvider: "onedrive",
      docHubRootLink: "D:\\Google Drive\\Project",
      docHubRootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
      docHubSettings: expect.objectContaining({
        gdrive: expect.objectContaining({
          rootId: "cloud-root",
          rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
        }),
        onedrive: {
          rootName: "Project",
          rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
        },
      }),
    }));
    const persistedSettings = onUpdate.mock.calls[0]?.[0]?.docHubSettings;
    expect(persistedSettings?.onedrive).not.toHaveProperty("rootLink");
    expect(persistedSettings?.onedrive).not.toHaveProperty("rootId");
  });

  it("restores the previous global root when marker persistence fails", async () => {
    mocks.storageGet.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    mocks.writeFile.mockRejectedValueOnce(new Error("disk full"));
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Owner\\New Project", name: "New Project" });
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const currentProject = project("project-1");
    const { result } = renderHook(() => useDocHubIntegration(currentProject, onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    await act(async () => result.current.actions.pickLocalFolder());

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      docHubRootLink: "D:\\Owner\\New Project",
    }));
    expect(onUpdate.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      docHubRootLink: "C:\\Owner\\project-1",
      docHubRootId: "connection:project-1",
    }));
    expect(mocks.storageSet).not.toHaveBeenCalled();
    expect(result.current.state.modalRequest?.message).toContain("disk full");
  });

  it("restores the previous marker and global root when secure storage fails", async () => {
    mocks.storageGet.mockResolvedValue(null);
    const previousMarker = createDocHubProjectMarker("project-1", "connection:project-1");
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(previousMarker));
    mocks.storageSet.mockRejectedValueOnce(new Error("secure storage unavailable"));
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Owner\\New Project", name: "New Project" });
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    await act(async () => result.current.actions.pickLocalFolder());

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile.mock.calls[1]?.[1]).toBe(previousMarker);
    expect(onUpdate.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      docHubRootLink: "C:\\Owner\\project-1",
      docHubRootId: "connection:project-1",
    }));
    expect(result.current.state.modalRequest?.message).toContain("secure storage unavailable");
  });

  it("invalidates a newly created marker when secure storage fails", async () => {
    mocks.storageGet.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("marker missing"));
    mocks.storageSet.mockRejectedValueOnce(new Error("secure storage unavailable"));
    mocks.selectFolder.mockResolvedValue({ path: "D:\\Owner\\New Project", name: "New Project" });
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    await act(async () => result.current.actions.pickLocalFolder());

    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile.mock.calls[1]?.[1]).toBe("{}\n");
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("ignores a completed folder picker after switching to another project", async () => {
    let resolvePicker: ((value: { path: string; name: string }) => void) | undefined;
    mocks.storageGet.mockResolvedValue(null);
    mocks.selectFolder.mockReturnValueOnce(new Promise((resolve) => { resolvePicker = resolve; }));
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ currentProject }) => useDocHubIntegration(currentProject, onUpdate, { userId: "owner-1" }),
      { initialProps: { currentProject: project("project-1") } },
    );
    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-1"));

    let pickerPromise: Promise<void> | undefined;
    act(() => { pickerPromise = result.current.actions.pickLocalFolder(); });
    rerender({ currentProject: project("project-2") });
    resolvePicker?.({ path: "D:\\Owner\\Project 1", name: "Project 1" });
    await act(async () => pickerPromise);

    await waitFor(() => expect(result.current.state.rootLink).toBe("C:\\Owner\\project-2"));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.storageSet).not.toHaveBeenCalled();
  });

  it("removes an owner's personal mapping before disconnecting the global root", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-1",
      connectionId: "connection:project-1",
      rootPath: "C:\\Owner\\project-1",
      rootName: "project-1",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));
    await waitFor(() => expect(result.current.state.hasPersonalLocalRoot).toBe(true));

    await act(async () => result.current.actions.disconnect());

    expect(mocks.storageDelete).toHaveBeenCalledWith("dochub:personal-location:v1:owner-1:project-1");
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ docHubStatus: "disconnected" }));
  });

  it("preserves a personal root when secure-storage deletion fails", async () => {
    mocks.storageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      userId: "shared-1",
      projectId: "project-1",
      connectionId: "connection:project-1",
      rootPath: "D:\\Shared\\project-1",
      rootName: "project-1",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    mocks.storageDelete.mockRejectedValueOnce(new Error("storage unavailable"));
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "shared-1",
    }));
    await waitFor(() => expect(result.current.state.rootLink).toBe("D:\\Shared\\project-1"));

    await act(async () => result.current.actions.disconnect());

    expect(result.current.state.rootLink).toBe("D:\\Shared\\project-1");
    expect(result.current.state.modalRequest?.message).toContain("storage unavailable");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("invalidates an older personal-root load after disconnect", async () => {
    let resolveOld: ((value: string) => void) | undefined;
    mocks.storageGet.mockReturnValueOnce(new Promise<string>((resolve) => { resolveOld = resolve; }));
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocHubIntegration(project("project-1"), onUpdate, {
      userId: "owner-1",
    }));

    await act(async () => result.current.actions.disconnect());
    resolveOld?.(JSON.stringify({
      version: 2,
      userId: "owner-1",
      projectId: "project-1",
      connectionId: "connection:project-1",
      rootPath: "C:\\Owner\\stale",
      rootName: "stale",
      savedAt: "2026-08-07T12:00:00.000Z",
    }));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.state.rootLink).toBe("");
    expect(result.current.state.hasPersonalLocalRoot).toBe(false);
  });

  it("does not clear the next project's state when disconnect finishes late", async () => {
    let resolveDelete: (() => void) | undefined;
    mocks.storageGet.mockImplementation((key: string) => Promise.resolve(
      key.endsWith(":project-2")
        ? JSON.stringify({
            version: 2,
            userId: "shared-1",
            projectId: "project-2",
            connectionId: "connection:project-2",
            rootPath: "D:\\Shared\\project-2",
            rootName: "project-2",
            savedAt: "2026-08-07T12:00:00.000Z",
          })
        : null,
    ));
    mocks.storageDelete.mockReturnValueOnce(new Promise<void>((resolve) => { resolveDelete = resolve; }));
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ currentProject }) => useDocHubIntegration(currentProject, onUpdate, { userId: "shared-1" }),
      { initialProps: { currentProject: project("project-1") } },
    );

    let disconnectPromise: Promise<void> | undefined;
    act(() => { disconnectPromise = result.current.actions.disconnect(); });
    rerender({ currentProject: project("project-2") });
    await waitFor(() => expect(result.current.state.rootLink).toBe("D:\\Shared\\project-2"));
    resolveDelete?.();
    await act(async () => disconnectPromise);

    expect(result.current.state.rootLink).toBe("D:\\Shared\\project-2");
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
