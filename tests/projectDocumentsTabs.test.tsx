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
const location = vi.hoisted(() => ({ search: "" }));
vi.mock("@shared/routing/router", () => ({
  useLocation: () => location,
}));

const project = { id: "project-tabs", name: "Test", demandCategories: [] } as unknown as ProjectDetails;

describe("document tab selection", () => {
  it("returns to PD when browser history removes the settings subsection", async () => {
    location.search = "?tab=project-settings&documentsSubTab=templates";
    const props = { project, onUpdate: vi.fn(), section: "settings" as const, canDocHub: false, canTemplates: true };
    const view = render(<ProjectDocuments {...props} />);
    await act(async () => {});
    expect(screen.getByRole("region", { name: "Šablony" })).toBeInTheDocument();
    location.search = "?tab=project-settings";
    view.rerender(<ProjectDocuments {...props} />);
    await act(async () => {});
    expect(screen.getByRole("region", { name: "Odkazy projektové dokumentace" })).toBeInTheDocument();
    location.search = "";
  });
  it("keeps price lists in documents and moves configuration into project settings", async () => {
    const props = { project, onUpdate: vi.fn(), canDocHub: false, canTemplates: false };
    const view = render(<ProjectDocuments {...props} section="documents" />);
    await act(async () => {});
    expect(screen.getByRole("tab", { name: "Ceníky" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /dokumentace/ })).not.toBeInTheDocument();
    view.rerender(<ProjectDocuments {...props} section="settings" />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Odkazy projektové dokumentace" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Odkazy projektové dokumentace" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ceníky" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Šablony" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Složkomat" })).not.toBeInTheDocument();
  });
  it("moves the selected state and panel label together when switching sections", async () => {
    await act(async () => {
      render(<ProjectDocuments project={project} onUpdate={vi.fn()}
        canDocHub={false} canTemplates={false} />);
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
