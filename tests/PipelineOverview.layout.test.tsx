import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineOverview } from "@/components/pipelineComponents/PipelineOverview";
import { formatMoney } from "@/utils/formatters";
import type { Bid, DemandCategory } from "@/types";

const hasNormalizedText = (expected: string) => (_content: string, element: Element | null) =>
  (element?.textContent ?? "").replace(/\s/g, " ").trim() === expected.replace(/\s/g, " ").trim();

const categories: DemandCategory[] = [
  {
    id: "cat-1",
    title: "Zemni prace",
    budget: "0 Kc",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 0,
    description: "",
  },
  {
    id: "cat-2",
    title: "Fasada",
    budget: "0 Kc",
    sodBudget: 0,
    planBudget: 0,
    status: "closed",
    subcontractorCount: 0,
    description: "",
  },
];

const renderOverview = (overrides: Partial<React.ComponentProps<typeof PipelineOverview>> = {}) =>
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
      {...overrides}
    />,
  );

describe("PipelineOverview layout", () => {
  it("has stable anchors for industrial skin view controls", () => {
    const { container } = renderOverview();

    const filters = container.querySelector("[data-help-id='pipeline-filters']");
    const viewToggle = container.querySelector("[data-help-id='pipeline-view-toggle']");
    const table = container.querySelector("[data-help-id='pipeline-overview-table']");

    expect(filters).toBeInTheDocument();
    expect(viewToggle).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(filters?.className).not.toContain("rounded-full");
    expect(viewToggle?.className).not.toContain("rounded-full");

    expect(screen.getByRole("button", { name: /V.*chny \(2\)/i }).className).toContain("text-primary");
    expect(screen.getByRole("button", { name: /V.*chny \(2\)/i }).className).not.toMatch(/bg-(amber|teal|emerald)/);
    expect(screen.getByRole("button", { name: /Popt.*van.* \(1\)/i }).className).not.toContain("rounded-full");
    expect(screen.getByRole("button", { name: /Ukon.*en.* \(1\)/i }).className).not.toContain("rounded-full");
  });

  it("parses winning prices with decimal commas without multiplying them", () => {
    const sodBid: Bid = {
      id: "bid-1",
      subcontractorId: "sup-1",
      companyName: "MIDOS Cheb",
      contactPerson: "Ing. Milan Dolejs",
      status: "sod",
      email: "dolejs@midos-cheb.cz",
      price: "159000,00",
    };

    renderOverview({
      categories: [categories[0]],
      bids: { [categories[0].id]: [sodBid] },
      viewMode: "grid",
    });

    expect(screen.getByText(hasNormalizedText(formatMoney(159000)))).toBeInTheDocument();
    expect(screen.queryByText(hasNormalizedText(formatMoney(15900000)))).not.toBeInTheDocument();
  });

  it("offers destructive table actions through an accessible context menu", () => {
    const onDeleteCategory = vi.fn();
    renderOverview({ onDeleteCategory });

    const row = screen.getByRole("row", { name: /Zemni prace/i });
    expect(screen.queryByRole("button", { name: "Upravit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Smazat" })).not.toBeInTheDocument();

    fireEvent.contextMenu(row, { clientX: 120, clientY: 180 });

    const menu = screen.getByRole("menu", { name: "Akce výběrového řízení" });
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Smazat" }));
    expect(onDeleteCategory).toHaveBeenCalledWith("cat-1");
  });

  it("opens the same context menu from the keyboard", async () => {
    renderOverview();
    const row = screen.getByRole("row", { name: /Fasada/i });

    row.focus();
    fireEvent.keyDown(row, { key: "F10", shiftKey: true });

    expect(
      screen.getByRole("menu", { name: "Akce výběrového řízení" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Smazat" })).toHaveFocus();
    });
  });
});
