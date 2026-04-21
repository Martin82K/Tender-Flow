import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubcontractorCardsView } from "../features/contacts/ui/SubcontractorCardsView";
import type { Subcontractor, StatusConfig } from "../types";

const statuses: StatusConfig[] = [
  { id: "available", label: "K dispozici", color: "green" },
  { id: "busy", label: "Zaneprázdněn", color: "red" },
];

function make(partial: Partial<Subcontractor>): Subcontractor {
  return {
    id: partial.id ?? crypto.randomUUID(),
    company: partial.company ?? "Firma",
    specialization: partial.specialization ?? ["Zednictví"],
    contacts: partial.contacts ?? [],
    status: partial.status ?? "available",
    regions: partial.regions,
    region: partial.region,
    ico: partial.ico,
    vendorRatingAverage: partial.vendorRatingAverage,
    vendorRatingCount: partial.vendorRatingCount,
  } as Subcontractor;
}

describe("SubcontractorCardsView", () => {
  it("vykreslí kartu pro každý kontakt", () => {
    const contacts = [
      make({ id: "a", company: "Alfa" }),
      make({ id: "b", company: "Beta" }),
    ];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    expect(screen.getByText("Alfa")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getAllByTestId("subcontractor-card")).toHaveLength(2);
  });

  it("zobrazí stav jako barevný text bez pill pozadí", () => {
    const contacts = [make({ id: "a", company: "Alfa", status: "available" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    const card = screen.getByTestId("subcontractor-card");
    const statusLabel = card.querySelector(
      'span[title="Stav: K dispozici"]',
    ) as HTMLElement | null;
    expect(statusLabel).not.toBeNull();
    expect(statusLabel!.className).toContain("text-green-600");
    expect(statusLabel!.className).not.toContain("bg-green-100");
    expect(statusLabel!.className).not.toContain("rounded-full");

    // V kartě nesmí být pill span s bg-slate* (specializace = jen text)
    expect(
      card.querySelector('span.rounded-full[class*="bg-slate"]'),
    ).toBeNull();
  });

  it("zobrazí specializace jako oddělený text (bez pills)", () => {
    const contacts = [
      make({
        id: "a",
        company: "Alfa",
        specialization: ["Zednictví", "Elektro", "Vodoinstalace"],
      }),
    ];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    expect(
      screen.getByText(/Zednictví.*Elektro.*Vodoinstalace/),
    ).toBeInTheDocument();
  });

  it("double-click na kartu zavolá onEditContact", () => {
    const handleEdit = vi.fn();
    const contacts = [make({ id: "a", company: "Alfa" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onEditContact={handleEdit}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("subcontractor-card"));
    expect(handleEdit).toHaveBeenCalledWith(contacts[0]);
  });

  it("pravé tlačítko myši otevře kontextové menu s položkou 'Editace kontaktu'", () => {
    const handleEdit = vi.fn();
    const contacts = [make({ id: "a", company: "Alfa" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onEditContact={handleEdit}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("subcontractor-card"), {
      clientX: 100,
      clientY: 100,
    });

    const menu = screen.getByTestId("contact-context-menu");
    expect(menu).toBeInTheDocument();

    const editItem = screen.getByRole("menuitem", {
      name: /Editace kontaktu/i,
    });
    fireEvent.click(editItem);

    expect(handleEdit).toHaveBeenCalledWith(contacts[0]);
    // Menu se zavře po akci
    expect(screen.queryByTestId("contact-context-menu")).toBeNull();
  });

  it("kontextové menu zavře Escape", () => {
    const contacts = [make({ id: "a", company: "Alfa" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onEditContact={() => undefined}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("subcontractor-card"));
    expect(screen.getByTestId("contact-context-menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("contact-context-menu")).toBeNull();
  });

  it("filtruje podle kraje působnosti", async () => {
    const contacts = [
      make({ id: "a", company: "Alfa", regions: ["PHA"] }),
      make({ id: "b", company: "Beta", regions: ["JHM"] }),
    ];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    expect(screen.getByText("Alfa")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    const regionSelect = screen.getByLabelText(
      "Filtr kraje působnosti",
    ) as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: "PHA" } });

    await waitFor(() => {
      expect(screen.getByText("Alfa")).toBeInTheDocument();
      expect(screen.queryByText("Beta")).toBeNull();
    });
  });

  it("checkbox na kartě přidá/odebere ID ze selection", () => {
    const handleSelectionChange = vi.fn();
    const contacts = [make({ id: "a", company: "Alfa" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={handleSelectionChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Vybrat Alfa/i });
    fireEvent.click(checkbox);
    expect(handleSelectionChange).toHaveBeenCalled();
    const [arg] = handleSelectionChange.mock.calls[0];
    expect(arg instanceof Set).toBe(true);
    expect(arg.has("a")).toBe(true);
  });

  it("kliknutí na checkbox nesmí spustit edit (stopPropagation)", () => {
    const handleEdit = vi.fn();
    const contacts = [make({ id: "a", company: "Alfa" })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onEditContact={handleEdit}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Vybrat Alfa/i }));
    expect(handleEdit).not.toHaveBeenCalled();
  });

  it("prázdný výsledek zobrazí hlášení a tlačítko Vymazat filtry", async () => {
    const contacts = [make({ id: "a", company: "Alfa", regions: ["PHA"] })];

    render(
      <SubcontractorCardsView
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    const regionSelect = screen.getByLabelText(
      "Filtr kraje působnosti",
    ) as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: "MSK" } });

    await waitFor(() => {
      expect(
        screen.getByText(/Nebyly nalezeny žádné kontakty/i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Vymazat filtry/i }));
    await waitFor(() => {
      expect(screen.getByText("Alfa")).toBeInTheDocument();
    });
  });
});
