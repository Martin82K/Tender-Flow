import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pipeline } from "../components/Pipeline";
import type { Bid, DemandCategory, ProjectDetails, Subcontractor } from "../types";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      role: "user",
      email: "user@example.com",
    },
  }),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
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

vi.mock("../components/pipelineComponents", () => {
  const dummy = () => null;
  const baseContact: Subcontractor = {
    id: "edit-contact",
    company: "Validni Dodavatel",
    specialization: ["Elektro"],
    contacts: [{ id: "p-1", name: "Kontakt", email: "k@example.com", phone: "123" }],
    status: "available",
    name: "Kontakt",
    email: "k@example.com",
    phone: "123",
  };

  return {
    Column: dummy,
    BidCard: dummy,
    EditBidModal: dummy,
    CategoryCard: dummy,
    PipelineOverview: dummy,
    BidComparisonPanel: dummy,
    CategoryFormModal: dummy,
    SubcontractorSelectorModal: ({
      onAddContact,
      onEditContact,
    }: {
      onAddContact: (name: string) => void;
      onEditContact: (contact: Subcontractor) => void;
    }) => (
      <div>
        <button onClick={() => onAddContact("CON")} data-testid="open-create">
          open-create
        </button>
        <button onClick={() => onEditContact(baseContact)} data-testid="open-edit">
          open-edit
        </button>
      </div>
    ),
    CreateContactModal: ({
      initialData,
      onSave,
    }: {
      initialData?: Subcontractor;
      onSave: (contact: Subcontractor) => void;
    }) => (
      <button
        data-testid={initialData ? "save-invalid-edit" : "save-invalid-create"}
        onClick={() =>
          onSave({
            id: initialData?.id || "new-contact",
            company: "CON",
            specialization: ["Elektro"],
            contacts: [{ id: "p-2", name: "Kontakt", email: "x@y.cz", phone: "123" }],
            status: "available",
            name: "Kontakt",
            email: "x@y.cz",
            phone: "123",
          })
        }
      >
        save
      </button>
    ),
  };
});

const baseCategory: DemandCategory = {
  id: "cat-1",
  title: "Elektroinstalace",
  budget: "0 Kc",
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

const createProjectDetails = (): ProjectDetails => ({
  id: "project-1",
  title: "Projekt A",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Vedouci",
  categories: [baseCategory],
  bids: { "cat-1": [baseBid] },
  docHubEnabled: false,
  docHubRootLink: "",
  docHubProvider: null,
  docHubStatus: "disconnected",
  docHubStructureV1: {},
});

const renderPipeline = () =>
  render(
    <Pipeline
      projectId="project-1"
      projectDetails={createProjectDetails()}
      bids={{ "cat-1": [baseBid] }}
      contacts={[]}
      initialOpenCategoryId="cat-1"
    />,
  );

describe("Pipeline contact name validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockImplementation(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null, data: [] }),
      })),
    }));
  });

  it("blocks create flow with invalid company name and shows alert", async () => {
    renderPipeline();

    fireEvent.click(screen.getByTestId("open-create"));
    fireEvent.click(screen.getByTestId("save-invalid-create"));

    await waitFor(() => {
      expect(screen.getByText(/Neplatny nazev dodavatele/i)).toBeInTheDocument();
    });

    expect(
      mocks.fromMock.mock.calls.some((call) => call[0] === "subcontractors"),
    ).toBe(false);
  });

  it("blocks edit flow with invalid company name and shows alert", async () => {
    renderPipeline();

    fireEvent.click(screen.getByTestId("open-edit"));
    fireEvent.click(screen.getByTestId("save-invalid-edit"));

    await waitFor(() => {
      expect(screen.getByText(/Neplatny nazev dodavatele/i)).toBeInTheDocument();
    });

    expect(
      mocks.fromMock.mock.calls.some((call) => call[0] === "subcontractors"),
    ).toBe(false);
  });
});
