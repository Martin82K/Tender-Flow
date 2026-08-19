import React, { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineOverview } from "@features/projects/pipeline";
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
      currentUserId="user-1"
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
      exportMeta={{
        organizationName: "REKO a.s.",
        projectTitle: "26026 Oprava mostu m.35",
        projectStatus: "realization",
        exportedBy: "Martin Kalkus",
        appVersion: "1.9.12",
      }}
      onExportError={vi.fn()}
      {...overrides}
    />,
  );

describe("PipelineOverview layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has stable anchors for industrial skin view controls", () => {
    const { container } = renderOverview();

    const filters = container.querySelector("[data-help-id='pipeline-filters']");
    const viewToggle = container.querySelector("[data-help-id='pipeline-view-toggle']");
    const table = container.querySelector("[data-help-id='pipeline-overview-table']");
    const toolbarLayer = container.querySelector("[data-pipeline-toolbar-layer]");

    expect(filters).toBeInTheDocument();
    expect(viewToggle).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(toolbarLayer).toHaveClass("relative", "z-20");
    expect(filters).toHaveClass("tf-demand-filterbar");
    expect(viewToggle?.className).not.toContain("rounded-full");

    const allFilter = screen.getByRole("button", { name: /V.*chny \(2\)/i });
    expect(allFilter).toHaveClass("tf-demand-filter-button");
    expect(allFilter).toHaveAttribute("data-active", "true");
    expect(allFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Popt.*van.* \(1\)/i })).toHaveAttribute("data-active", "false");
    expect(screen.getByRole("button", { name: /Ukon.*en.* \(1\)/i })).toHaveClass("tf-demand-filter-button");
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

  it("otevře kategorii po krátkém rozlišení jednoduchého kliku", () => {
    vi.useFakeTimers();
    const onCategoryClick = vi.fn();
    renderOverview({ onCategoryClick });

    fireEvent.click(screen.getByRole("row", { name: /Zemni prace/i }));
    expect(onCategoryClick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(220);
    expect(onCategoryClick).toHaveBeenCalledWith(categories[0]);
  });

  it("dvojklik otevře editaci a zruší čekající navigaci", () => {
    vi.useFakeTimers();
    const onCategoryClick = vi.fn();
    const onEditCategory = vi.fn();
    renderOverview({ onCategoryClick, onEditCategory });
    const row = screen.getByRole("row", { name: /Fasada/i });

    fireEvent.click(row);
    fireEvent.doubleClick(row);
    vi.runAllTimers();

    expect(onEditCategory).toHaveBeenCalledWith(categories[1]);
    expect(onCategoryClick).not.toHaveBeenCalled();
  });

  it("po odpojení komponenty nespustí čekající navigaci", () => {
    vi.useFakeTimers();
    const onCategoryClick = vi.fn();
    const { unmount } = renderOverview({ onCategoryClick });

    fireEvent.click(screen.getByRole("row", { name: /Zemni prace/i }));
    unmount();
    vi.runAllTimers();

    expect(onCategoryClick).not.toHaveBeenCalled();
  });

  it("načte pouze validní číselné šířky aktuálního uživatele", () => {
    window.localStorage.setItem(
      "tf.pipeline.tableColumns.v1.user-1",
      JSON.stringify({
        version: 1,
        widths: {
          demand: 260,
          realization: 9_999,
          deadline: "neplatná hodnota",
          attacker: 666,
        },
        organization: { name: "nesmí se načíst" },
      }),
    );

    renderOverview();

    expect(screen.getByRole("separator", { name: "Změnit šířku sloupce Poptávka" })).toHaveAttribute(
      "aria-valuenow",
      "260",
    );
    expect(screen.getByRole("separator", { name: "Změnit šířku sloupce Realizace" })).toHaveAttribute(
      "aria-valuenow",
      "420",
    );
    expect(screen.getByRole("separator", { name: "Změnit šířku sloupce Termín" })).toHaveAttribute(
      "aria-valuenow",
      "120",
    );
  });

  it("nepřenáší preference mezi uživateli ani je neukládá bez identity", () => {
    window.localStorage.setItem(
      "tf.pipeline.tableColumns.v1.user-1",
      JSON.stringify({ version: 1, widths: { demand: 260 } }),
    );

    const { unmount } = renderOverview({ currentUserId: "user-2" });
    expect(screen.getByRole("separator", { name: "Změnit šířku sloupce Poptávka" })).toHaveAttribute(
      "aria-valuenow",
      "320",
    );
    unmount();

    renderOverview({ currentUserId: null });
    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Změnit šířku sloupce Poptávka" }),
      { key: "ArrowLeft" },
    );
    expect([...Array(window.localStorage.length)].map((_, index) => window.localStorage.key(index)))
      .not.toContain("tf.pipeline.tableColumns.v1.anonymous");
  });

  it("zůstane použitelná, když prohlížeč zablokuje čtení localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });

    renderOverview();

    expect(screen.getByRole("separator", { name: "Změnit šířku sloupce Poptávka" }))
      .toHaveAttribute("aria-valuenow", "320");
  });

  it("mění šířku klávesnicí a ukládá pouze číselnou mapu šířek", () => {
    renderOverview();
    const handle = screen.getByRole("separator", { name: "Změnit šířku sloupce Poptávka" });

    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });

    expect(handle).toHaveFocus();
    expect(handle).toHaveAttribute("aria-valuenow", "280");
    expect(JSON.parse(window.localStorage.getItem("tf.pipeline.tableColumns.v1.user-1") || "null"))
      .toEqual({
        version: 1,
        widths: expect.objectContaining({ demand: 280 }),
      });
  });

  it("mění šířku tažením a zachová no-wrap termínů v horizontálně posuvné tabulce", () => {
    const { container } = renderOverview();
    const handle = screen.getByRole("separator", { name: "Změnit šířku sloupce Realizace" });

    const pointerDown = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(pointerDown, "clientX", { value: 200 });
    const pointerMove = new Event("pointermove");
    Object.defineProperty(pointerMove, "clientX", { value: 260 });
    act(() => {
      handle.dispatchEvent(pointerDown);
      window.dispatchEvent(pointerMove);
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(handle).toHaveAttribute("aria-valuenow", "300");
    expect(screen.getByRole("columnheader", { name: /Termín/ })).toHaveClass("whitespace-nowrap");
    expect(screen.getByRole("columnheader", { name: /Realizace/ })).toHaveClass("whitespace-nowrap");
    expect(container.querySelector("[data-pipeline-table-scroll]")).toHaveClass("overflow-x-auto");
    expect(container.querySelector("table")).toHaveClass("w-full");
    expect(container.querySelector("table")).toHaveStyle({ minWidth: "1272px" });
  });

  it("roztáhne tabulku na dostupnou šířku a na úzkém prostoru zachová minimální šířku", () => {
    const { container } = renderOverview();

    const table = container.querySelector("table");
    expect(table).toHaveClass("w-full");
    expect(table).toHaveStyle({ minWidth: "1212px" });
    expect(table).not.toHaveStyle({ width: "1212px" });
  });

  it("rozbalí dodavatele do podřízených řádků ve stylu dodatků smlouvy", () => {
    const supplier: Bid = {
      id: "bid-supplier",
      subcontractorId: "supplier-1",
      companyName: "Dodavatel Alfa s.r.o.",
      contactPerson: "Jan Novák",
      email: "jan@example.cz",
      price: "125000,00",
      status: "offer",
      notes: "Cena včetně dopravy",
    };
    renderOverview({
      categories: [categories[0]],
      bids: { [categories[0].id]: [supplier] },
    });

    const toggle = screen.getByRole("button", {
      name: "Rozbalit poptané dodavatele VŘ Zemni prace",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Dodavatel Alfa s.r.o.")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Dodavatel Alfa s.r.o.")).toBeInTheDocument();
    expect(screen.getByText("Dodal cenu")).toBeInTheDocument();
    expect(screen.getByText("Cena včetně dopravy")).toBeInTheDocument();
    expect(screen.getByText("Dodal cenu")).toHaveAttribute("data-bid-status", "offer");
    expect(screen.getByText("Dodal cenu")).not.toHaveClass("rounded-md", "border");
    expect(screen.getByRole("row", { name: /Dodavatel Alfa s\.r\.o\./i })).toHaveAttribute(
      "data-parent-category-id",
      "cat-1",
    );
  });

  it("rozlišuje užší výběr, jednání o SOD a zasmluvněného dodavatele", () => {
    const statusBids: Bid[] = [
      {
        id: "bid-shortlist",
        subcontractorId: "supplier-shortlist",
        companyName: "Užší kandidát",
        contactPerson: "Jan Novák",
        status: "shortlist",
      },
      {
        id: "bid-sod",
        subcontractorId: "supplier-sod",
        companyName: "Vyjednávaný dodavatel",
        contactPerson: "Eva Malá",
        status: "sod",
        contracted: false,
      },
      {
        id: "bid-contracted",
        subcontractorId: "supplier-contracted",
        companyName: "Smluvní dodavatel",
        contactPerson: "Petr Svoboda",
        status: "sod",
        contracted: true,
      },
    ];
    renderOverview({
      categories: [categories[0]],
      bids: { [categories[0].id]: statusBids },
    });

    fireEvent.click(screen.getByRole("button", {
      name: "Rozbalit poptané dodavatele VŘ Zemni prace",
    }));

    expect(screen.getByText("Užší výběr")).toHaveAttribute("data-bid-status", "shortlist");
    expect(screen.getByText("Jednání o SOD")).toHaveAttribute("data-bid-status", "sod");
    expect(screen.getByText("Zasmluvněn")).toHaveAttribute("data-bid-status", "sod");
    expect(screen.queryByText("Vybrán")).not.toBeInTheDocument();
  });

  it("nabídne export aktuální tabulky do XLSX a PDF", () => {
    renderOverview();

    expect(screen.getByRole("button", { name: "Exportovat přehled VŘ do XLSX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportovat přehled VŘ do PDF" })).toBeInTheDocument();
  });
});
