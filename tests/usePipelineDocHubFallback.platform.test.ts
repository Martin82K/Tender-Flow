import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "@/types";
import { resolveDocHubStructureV1 } from "@shared/dochub/docHub";

const mocks = vi.hoisted(() => ({ desktop: false, ensureStructure: vi.fn(), invoke: vi.fn() }));
vi.mock("@infra/platform/platformAdapter", () => ({ get isDesktop() { return mocks.desktop; } }));
vi.mock("@infra/files/fileSystemService", () => ({ ensureStructure: mocks.ensureStructure }));
vi.mock("@infra/functions/functionsClient", () => ({ invokeAuthedFunction: mocks.invoke }));
import { usePipelineDocHubFallback } from "@features/projects/model/usePipelineDocHubFallback";

const renderFallback = (provider: ProjectDetails["docHubProvider"] = "onedrive") => {
  const project = {
    id: "project-test", docHubProvider: provider,
    categories: [{ id: "category-test", title: "Test category" }],
  } as ProjectDetails;
  return renderHook(() => usePipelineDocHubFallback({
    projectId: project.id!, projectData: project, projectDetails: project,
    bids: { "category-test": [{ id: "bid-test", subcontractorId: "supplier-test", companyName: "Test supplier", status: "contacted" }] },
    docHubRoot: "/test/root", isDocHubEnabled: true,
    docHubStructure: resolveDocHubStructureV1({}), userRole: "admin", activeCategoryId: "category-test",
  }));
};

describe("Pipeline DocHub fallback platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.desktop = false;
    mocks.ensureStructure.mockResolvedValue({ success: true });
    mocks.invoke.mockResolvedValue({});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("skips automatic and requested local fallback on web", async () => {
    const { result } = renderFallback();
    await act(async () => result.current.runDocHubFallbackForCategory("category-test", "manual"));
    expect(mocks.ensureStructure).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("preserves project and category local fallback on desktop", async () => {
    mocks.desktop = true;
    renderFallback();
    await waitFor(() => expect(mocks.ensureStructure).toHaveBeenCalledTimes(2));
  });

  it.each(["gdrive", "onedrive_cloud"] as const)("preserves %s cloud fallback on web", async (provider) => {
    renderFallback(provider);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("dochub-autocreate", { body: { projectId: "project-test" } }));
    expect(mocks.invoke).toHaveBeenCalledWith("dochub-get-link", expect.objectContaining({ body: expect.objectContaining({ categoryId: "category-test" }) }));
    expect(mocks.ensureStructure).not.toHaveBeenCalled();
  });

  it("still reports actual desktop filesystem failures", async () => {
    mocks.desktop = true;
    mocks.ensureStructure.mockResolvedValue({ success: false, error: "Access denied" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderFallback();
    await waitFor(() => expect(error).toHaveBeenCalledWith("[DocHub fallback] Project ensureStructure failed", expect.objectContaining({ error: "Access denied" })));
  });
});
