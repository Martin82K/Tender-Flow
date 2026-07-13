import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineCategoryNavigation } from "@/features/projects/model/usePipelineCategoryNavigation";

const mocks = vi.hoisted(() => ({
  folderExists: vi.fn(),
}));

vi.mock("@infra/files/fileSystemService", () => ({
  folderExists: mocks.folderExists,
}));

vi.mock("@infra/diagnostics/incidentLogger", () => ({
  logIncident: vi.fn(),
}));

describe("usePipelineCategoryNavigation cesta složky VŘ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("použije stejnou filesystem sanitizaci názvu jako ensureStructure", async () => {
    const expectedPath =
      "/Projects/Stavba/03_Vyberova_rizeni/Smoke příloha 2026-07-13 17_05";
    mocks.folderExists.mockImplementation(async (path: string) => path === expectedPath);

    const { result } = renderHook(() =>
      usePipelineCategoryNavigation({
        projectId: "project-1",
        categories: [],
        docHubRoot: "/Projects/Stavba",
      }),
    );

    let resolvedPath: string | null = null;
    await act(async () => {
      resolvedPath = await result.current.resolveDesktopTenderFolderPath(
        "Smoke příloha 2026-07-13 17:05",
      );
    });

    expect(resolvedPath).toBe(expectedPath);
    expect(mocks.folderExists).toHaveBeenCalledTimes(1);
    expect(mocks.folderExists).toHaveBeenCalledWith(expectedPath);
  });
});
