import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigate } from "@shared/routing/router";
import { ProjectDocumentsWorkspace } from "@features/projects/documents/ui/ProjectDocumentsWorkspace";
import type { ProjectDetails } from "@/types";

vi.mock("@features/projects/client/clientCardApi", () => ({
  clientCardApi: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));

const project: ProjectDetails = {
  id: "project-1",
  title: "Bytový dům Javor",
  organizationId: "org-1",
  location: "Praha",
  finishDate: "",
  siteManager: "",
  categories: [],
  investorFinancials: {
    sodPrice: 1000,
    customerName: "Původní",
    amendments: [],
    invoices: [],
  },
};

const renderWorkspace = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ProjectDocumentsWorkspace
      projectId="project-1"
      project={project}
      onUpdate={vi.fn()}
      contractsEnabled={false}
      readOnly={false}
      contractsState={{ contracts: [], loading: false, error: null, refresh: vi.fn() } as never}
      currentUserId="user-1"
    />
  </QueryClientProvider>,
);

describe("Dokumenty → Objednatel", () => {
  beforeEach(() => {
    navigate("/app/project/project-1?tab=documents&documentsSubTab=investor");
  });

  it("zobrazí kartu identity místo placeholderu", async () => {
    renderWorkspace();
    expect(await screen.findByText("Objednatel není vyplněn")).toBeInTheDocument();
    expect(screen.queryByText("Ve vývoji")).not.toBeInTheDocument();
    expect(screen.getByText("Bytový dům Javor")).toBeInTheDocument();
  });
});
