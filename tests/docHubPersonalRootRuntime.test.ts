import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { resolveEffectiveProjectDocHubRoot } from "@features/projects/dochub/model/personalRoot";

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
});
