import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { Pipeline } from "../components/Pipeline";
import { formatMoney } from "../utils/formatters";
import type { Bid, DemandCategory, ProjectDetails } from "../types";

const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const hasNormalizedText = (expected: string) => (_content: string, element: Element | null) =>
  (element?.textContent ?? "").replace(/\s/g, " ").trim() === expected.replace(/\s/g, " ").trim();

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

vi.mock("@infra/files/fileSystemService", () => ({
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

const offerBid: Bid = {
  id: "bid-2",
  subcontractorId: "sup-2",
  companyName: "Barkotex",
  contactPerson: "Petr Polanecký",
  status: "offer",
  email: "polanecky@barkotex.cz",
  phone: "727 985 457",
  price: "77 000 Kč",
  selectionRound: 0,
  priceHistory: {
    0: "77 000 Kč",
    1: "77 000 Kč",
  },
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

const createProjectDetailsWithBids = (
  category: DemandCategory,
  categoryBids: Bid[],
): ProjectDetails => ({
  id: "project-1",
  title: "Projekt A",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Vedoucí",
  categories: [category],
  bids: { [category.id]: categoryBids },
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
    { wrapper: QueryWrapper },
  );

const renderPipelineWithBids = (category: DemandCategory, categoryBids: Bid[]) =>
  render(
    <Pipeline
      projectId="project-1"
      projectDetails={createProjectDetailsWithBids(category, categoryBids)}
      bids={{ [category.id]: categoryBids }}
      contacts={[]}
      initialOpenCategoryId={category.id}
    />,
    { wrapper: QueryWrapper },
  );

describe("Pipeline category summary", () => {
  it("renders Cena SOD and Interní plán above kanban detail", async () => {
    renderPipeline(createCategory());

    expect(await screen.findAllByText("Elektroinstalace")).toHaveLength(2);
    expect(await screen.findByText("Cena SOD:")).toBeInTheDocument();
    expect(screen.getByText("Interní plán:")).toBeInTheDocument();
    expect(screen.getByText(hasNormalizedText(formatMoney(1250000)))).toBeInTheDocument();
    expect(screen.getByText(hasNormalizedText(formatMoney(980000)))).toBeInTheDocument();
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
    expect(screen.getAllByText(hasNormalizedText(formatMoney(0)))).toHaveLength(2);
  });

  it("otevre modal Upravit nabídku pri dvojkliku na kartu subdodavatele v kanbanu", async () => {
    renderPipelineWithBids(createCategory(), [offerBid]);

    const bidCardTitle = await screen.findByText("Barkotex");
    fireEvent.doubleClick(bidCardTitle.closest("div[draggable='true']") as HTMLElement);

    expect(await screen.findByText("Upravit nabídku")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Petr Polanecký")).toBeInTheDocument();
    expect(screen.getByDisplayValue("polanecky@barkotex.cz")).toBeInTheDocument();
  });
});
