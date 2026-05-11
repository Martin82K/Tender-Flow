import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineOverview } from "@/components/pipelineComponents/PipelineOverview";
import type { DemandCategory } from "@/types";

const categories: DemandCategory[] = [
  {
    id: "cat-1",
    title: "Zemní práce",
    budget: "0 Kč",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 0,
    description: "",
  },
  {
    id: "cat-2",
    title: "Fasáda",
    budget: "0 Kč",
    sodBudget: 0,
    planBudget: 0,
    status: "closed",
    subcontractorCount: 0,
    description: "",
  },
];

const renderOverview = () =>
  render(
    <PipelineOverview
      categories={categories}
      bids={{}}
      searchQuery=""
      demandFilter="all"
      viewMode="table"
      onFilterChange={vi.fn()}
      onViewModeChange={vi.fn()}
      onCategoryClick={vi.fn()}
      onAddClick={vi.fn()}
      onEditCategory={vi.fn()}
      onDeleteCategory={vi.fn()}
      onToggleCategoryComplete={vi.fn()}
    />,
  );

describe("PipelineOverview layout", () => {
  it("má stabilní kotvy pro industrial skin průřezových přepínačů", () => {
    const { container } = renderOverview();

    const filters = container.querySelector("[data-help-id='pipeline-filters']");
    const viewToggle = container.querySelector("[data-help-id='pipeline-view-toggle']");
    const table = container.querySelector("[data-help-id='pipeline-overview-table']");

    expect(filters).toBeInTheDocument();
    expect(viewToggle).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(filters?.className).not.toContain("rounded-full");
    expect(viewToggle?.className).not.toContain("rounded-full");

    expect(screen.getByRole("button", { name: /Všechny \(2\)/i }).className).not.toContain("bg-white");
    expect(screen.getByRole("button", { name: /Poptávané \(1\)/i }).className).not.toContain("rounded-full");
    expect(screen.getByRole("button", { name: /Ukončené \(1\)/i }).className).not.toContain("rounded-full");
  });
});
