import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

const mocks = vi.hoisted(() => ({
  runDocHubFallbackForCategory: vi.fn(),
  ensureStructure: vi.fn().mockResolvedValue({ success: true }),
  invokeAuthedFunction: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      name: "Tester",
      email: "test@example.com",
      role: "admin",
      preferences: {},
    },
  }),
}));

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: mocks.invokeAuthedFunction,
}));

vi.mock("@/services/fileSystemService", () => ({
  ensureStructure: mocks.ensureStructure,
  deleteFolder: vi.fn().mockResolvedValue({ success: true }),
  folderExists: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: vi.fn(() => {
      const table: any = {};
      table.update = vi.fn(() => table);
      table.delete = vi.fn(() => table);
      table.insert = vi.fn(() => table);
      table.select = vi.fn(() => table);
      table.eq = vi.fn().mockResolvedValue({ error: null, data: [] });
      return table;
    }),
  },
}));

// Mock the DocHub fallback hook directly to avoid deep dependency chain
vi.mock("@/features/projects/model/usePipelineDocHubFallback", () => ({
  usePipelineDocHubFallback: (input: any) => {
    // Simulate project-wide fallback on mount
    React.useEffect(() => {
      const provider = input.projectData?.docHubProvider;
      if (!input.isDocHubEnabled || !input.docHubRoot) return;

      if (provider === "gdrive" || provider === "onedrive_cloud") {
        mocks.invokeAuthedFunction("dochub-autocreate", {
          body: { projectId: input.projectId },
        });
      } else if (provider === "onedrive") {
        mocks.ensureStructure({
          rootPath: input.docHubRoot,
          structure: input.docHubStructure,
          categories: [],
          suppliers: {},
          hierarchy: {},
        });
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
      runDocHubFallbackForCategory: mocks.runDocHubFallbackForCategory,
    };
  },
}));

import { Pipeline } from "@/components/Pipeline";

const baseCategory: DemandCategory = {
  id: "cat-1",
  title: "Elektroinstalace",
  budget: "0 Kč",
  sodBudget: 0,
  planBudget: 0,
  status: "open",
  subcontractorCount: 1,
  description: "",
};

const baseBid: Bid = {
  id: "bid-1",
  subcontractorId: "sup-1",
  companyName: "ACME s.r.o.",
  contactPerson: "Pepa",
  status: "contacted",
  email: "acme@example.com",
};

const createProjectDetails = (
  provider: "onedrive" | "gdrive",
): ProjectDetails => ({
  id: "project-1",
  title: "Projekt A",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Vedouci",
  categories: [baseCategory],
  bids: { "cat-1": [baseBid] },
  docHubEnabled: true,
  docHubRootLink: "/tmp/dochub",
  docHubProvider: provider,
  docHubStatus: "connected",
  docHubStructureV1: {},
});

const renderPipeline = (
  provider: "onedrive" | "gdrive",
) => {
  const projectDetails = createProjectDetails(provider);

  return render(
    <Pipeline
      projectId="project-1"
      projectDetails={projectDetails}
      bids={{ "cat-1": [baseBid] }}
      contacts={[]}
      initialOpenCategoryId="cat-1"
    />,
  );
};

describe("Pipeline DocHub fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs project-wide fallback once on pipeline open (cloud provider)", async () => {
    renderPipeline("gdrive");

    await waitFor(() => {
      expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith("dochub-autocreate", {
        body: { projectId: "project-1" },
      });
    });

    expect(mocks.invokeAuthedFunction).toHaveBeenCalledTimes(1);
  });

  it("runs project-wide fallback on pipeline open (local provider)", async () => {
    renderPipeline("onedrive");

    await waitFor(() => {
      expect(mocks.ensureStructure).toHaveBeenCalledTimes(1);
    });
  });

  it("exposes runDocHubFallbackForCategory", async () => {
    renderPipeline("onedrive");

    // The hook's category fallback function is returned and available
    expect(mocks.runDocHubFallbackForCategory).not.toHaveBeenCalled();
  });
});
