import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";
import type { ProjectDetails } from "@/types";

vi.mock("@features/projects/documents/model/useDocHubIntegration", () => ({
  useDocHubIntegration: () => ({
    state: { isConnected: false, links: {}, structureDraft: {} },
    actions: {},
    setters: {},
  }),
}));
vi.mock("@/services/templateService", () => ({
  getProjectTemplateSelection: vi.fn(async () => undefined),
  getTemplateById: vi.fn(async () => undefined),
  saveProjectTemplateSelection: vi.fn(),
}));
vi.mock("@features/projects/documents/ui/TemplateManager", () => ({
  TemplateManager: () => null,
}));
vi.mock("@shared/routing/router", () => ({
  useLocation: () => ({ search: "" }),
}));

const project = { id: "project-tabs", name: "Test", demandCategories: [] } as unknown as ProjectDetails;

describe("document tab selection", () => {
  it("moves the selected state and panel label together when switching sections", async () => {
    await act(async () => {
      render(<ProjectDocuments project={project} onUpdate={vi.fn()}
        canDocHub={false} canTemplates={false} autoShortenProjectDocs={false} />);
    });

    const documents = screen.getByRole("tab", { name: "Projektová dokumentace" });
    const prices = screen.getByRole("tab", { name: "Ceníky" });
    expect(documents).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Projektová dokumentace");

    fireEvent.click(prices);
    expect(prices).toHaveAttribute("aria-selected", "true");
    expect(documents).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Ceníky");

    fireEvent.click(documents);
    expect(documents).toHaveAttribute("aria-selected", "true");
    expect(prices).toHaveAttribute("aria-selected", "false");
    expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
    expect(screen.queryByRole("tab", { name: "Složkomat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Šablony" })).not.toBeInTheDocument();
  });
});
