import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pipeline } from "../components/Pipeline";
import { ensureStructure } from "../services/fileSystemService";
import { invokeAuthedFunction } from "../services/functionsClient";
import type { Bid, DemandCategory, ProjectDetails } from "../types";

vi.mock("../context/AuthContext", () => ({
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

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../services/fileSystemService", () => ({
  ensureStructure: vi.fn().mockResolvedValue({
    success: true,
    rootPath: "/tmp/dochub",
    createdCount: 0,
    reusedCount: 0,
    logs: [],
  }),
  deleteFolder: vi.fn().mockResolvedValue({ success: true }),
  folderExists: vi.fn().mockResolvedValue(false),
}));

vi.mock("../services/supabase", () => ({
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
  provider: "mcp" | "onedrive" | "gdrive" | "onedrive_cloud",
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

const getDropZoneByColumnTitle = (title: string) => {
  const header = screen.getByText(title);
  const dropZone = header.closest("div")?.parentElement;
  if (!dropZone) {
    throw new Error(`Drop zone not found for column title: ${title}`);
  }
  return dropZone;
};

const renderPipeline = (
  provider: "mcp" | "onedrive" | "gdrive" | "onedrive_cloud",
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
    const { rerender } = renderPipeline("gdrive");

    await waitFor(() => {
      expect(invokeAuthedFunction).toHaveBeenCalledWith("dochub-autocreate", {
        body: { projectId: "project-1" },
      });
    });

    rerender(
      <Pipeline
        projectId="project-1"
        projectDetails={createProjectDetails("gdrive")}
        bids={{ "cat-1": [baseBid] }}
        contacts={[]}
        initialOpenCategoryId="cat-1"
      />,
    );

    await waitFor(() => {
      const calls = (invokeAuthedFunction as any).mock.calls.filter(
        (call: any[]) => call[0] === "dochub-autocreate",
      );
      expect(calls).toHaveLength(1);
    });
  });

  it("runs category fallback when bid is moved to sent", async () => {
    renderPipeline("mcp");
    await screen.findByText("Odesláno");

    await waitFor(() => {
      expect(ensureStructure).toHaveBeenCalledTimes(1);
    });

    fireEvent.drop(getDropZoneByColumnTitle("Odesláno"), {
      dataTransfer: { getData: () => "bid-1" },
    });

    await waitFor(() => {
      expect(ensureStructure).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByText("DocHub chyba")).not.toBeInTheDocument();
    expect(screen.queryByText("Chyba vytvoření složek")).not.toBeInTheDocument();
  });

  it("does not run category fallback when bid is moved to rejected", async () => {
    renderPipeline("mcp");
    await screen.findByText("Zamítnuto / Odstoupili");

    await waitFor(() => {
      expect(ensureStructure).toHaveBeenCalledTimes(1);
    });

    fireEvent.drop(getDropZoneByColumnTitle("Zamítnuto / Odstoupili"), {
      dataTransfer: { getData: () => "bid-1" },
    });

    await waitFor(() => {
      expect(ensureStructure).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("DocHub chyba")).not.toBeInTheDocument();
    expect(screen.queryByText("Chyba vytvoření složek")).not.toBeInTheDocument();
  });
});
