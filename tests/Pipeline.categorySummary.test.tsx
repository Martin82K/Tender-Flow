import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pipeline } from "../components/Pipeline";
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

const baseBid: Bid = {
  id: "bid-1",
  subcontractorId: "sup-1",
  companyName: "ACME s.r.o.",
  contactPerson: "Pepa",
  status: "contacted",
  email: "acme@example.com",
};

const createCategory = (
  overrides: Partial<DemandCategory> = {},
): DemandCategory => ({
  id: "cat-1",
  title: "Elektroinstalace",
  budget: "0 Kč",
  sodBudget: 1250000,
  planBudget: 980000,
  status: "open",
  subcontractorCount: 1,
  description: "",
  ...overrides,
});

const createProjectDetails = (category: DemandCategory): ProjectDetails => ({
  id: "project-1",
  title: "Projekt A",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Vedoucí",
  categories: [category],
  bids: { [category.id]: [baseBid] },
  docHubEnabled: false,
  docHubRootLink: "",
  docHubProvider: null,
  docHubStatus: "disconnected",
  docHubStructureV1: {},
});

const renderPipeline = (category: DemandCategory) =>
  render(
    <Pipeline
      projectId="project-1"
      projectDetails={createProjectDetails(category)}
      bids={{ [category.id]: [baseBid] }}
      contacts={[]}
      initialOpenCategoryId={category.id}
    />,
  );

describe("Pipeline category summary", () => {
  it("renders Cena SOD and Interní plán above kanban detail", async () => {
    renderPipeline(createCategory());

    expect(await screen.findAllByText("Elektroinstalace")).toHaveLength(2);
    expect(await screen.findByText("Cena SOD:")).toBeInTheDocument();
    expect(screen.getByText("Interní plán:")).toBeInTheDocument();
    expect(screen.getByText("1 250 000 Kč")).toBeInTheDocument();
    expect(screen.getByText("980 000 Kč")).toBeInTheDocument();
  });

  it("renders zero values safely when category budgets are empty", async () => {
    renderPipeline(
      createCategory({
        sodBudget: 0,
        planBudget: 0,
      }),
    );

    expect(await screen.findAllByText("Elektroinstalace")).toHaveLength(2);
    expect(await screen.findByText("Cena SOD:")).toBeInTheDocument();
    expect(screen.getByText("Interní plán:")).toBeInTheDocument();
    expect(screen.getAllByText("0 Kč")).toHaveLength(2);
  });
});
