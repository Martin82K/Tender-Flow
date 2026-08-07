import { describe, expect, it, vi } from "vitest";

import type { ProjectDetails } from "@/types";

vi.mock("@/services/platformAdapter", () => ({
  isDesktop: false,
  storageAdapter: { get: vi.fn() },
  fileSystemAdapter: {},
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

describe("DocHub effective web root", () => {
  it("preserves the global local root for its owner in the web app", async () => {
    await expect(resolveEffectiveProjectDocHubRoot(project, "owner-1"))
      .resolves.toBe("C:\\Owner\\Project");
  });

  it("does not expose the owner's local root to a shared web user", async () => {
    await expect(resolveEffectiveProjectDocHubRoot(project, "shared-1"))
      .resolves.toBe("");
  });
});
