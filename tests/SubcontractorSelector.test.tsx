import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  formatAdditionalContactsTitle,
  getAdditionalContactPersons,
  getRowContactPerson,
  SubcontractorSelector,
} from "../shared/ui/SubcontractorSelector";
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
  } as Subcontractor;
}

describe("SubcontractorSelector", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("používá společný skinovaný výběr pro všechny filtry", () => {
    render(
      <SubcontractorSelector
        contacts={[]}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    const specializationSelect = screen.getByLabelText(
      "Filtr specializace",
    );
    const statusSelect = screen.getByLabelText(
      "Filtr stavu",
    );
    const regionSelect = screen.getByLabelText(
      "Filtr kraje působnosti",
    );

    for (const el of [specializationSelect, statusSelect, regionSelect]) {
      expect(el).toHaveClass("tf-themed-select-trigger");
    }
  });

  it("nabízí filtr podle kraje působnosti se všemi 14 kraji ČR", () => {
    render(
      <SubcontractorSelector
        contacts={[]}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByLabelText("Filtr kraje působnosti"));
    const options = screen.getAllByRole("option");

    expect(screen.getByRole("option", { name: "Všechny kraje působnosti" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Praha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Středočeský" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jihomoravský" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Moravskoslezský" })).toBeInTheDocument();
    // 14 krajů + "all"
    expect(options).toHaveLength(15);
  });

  it("filtruje kontakty podle vybraného kraje a propaguje do callbacku", async () => {
    const contacts = [
      make({ id: "a", company: "Alfa", regions: ["PHA"] }),
      make({ id: "b", company: "Beta", regions: ["JHM"] }),
    ];
    const onFilteredChange = vi.fn();

    render(
      <SubcontractorSelector
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onFilteredContactsChange={onFilteredChange}
      />,
    );

    // Initial: mount may fire once with all items
    await waitFor(() => expect(onFilteredChange).toHaveBeenCalled());
    onFilteredChange.mockClear();

    fireEvent.click(screen.getByLabelText("Filtr kraje působnosti"));
    fireEvent.click(screen.getByRole("option", { name: "Praha" }));

    await waitFor(() => {
      const lastCall =
        onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1];
      expect(lastCall[0].map((c: Subcontractor) => c.id)).toEqual(["a"]);
    });
  });

  it("toggle sloupce obsahuje novou položku 'Kraj působnosti'", () => {
    render(
      <SubcontractorSelector
        contacts={[]}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTitle("Zobrazení sloupců"));
    // "Kraj působnosti" je v column menu a zároveň header tabulky
    expect(screen.getAllByText("Kraj působnosti").length).toBeGreaterThan(0);
  });

  it("nerenderuje edit ikonu v toolbaru (edit je dostupný přes pravé tlačítko)", () => {
    const contacts = [make({ id: "a", company: "Alfa" })];

    const { container } = render(
      <SubcontractorSelector
        contacts={contacts}
        statuses={statuses}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
        onEditContact={() => undefined}
      />,
    );

    expect(container.querySelector('button[title="Upravit"]')).toBeNull();
  });

  it("pro seznam vybere jeden řádkový kontakt a zbytek nechá jen jako dodatečný počet", () => {
    const contacts = [
      make({
        id: "a",
        company: "Alfa",
        contacts: [
          {
            id: "p1",
            name: "Jan Novák",
            phone: "+420 777 123 456",
            email: "jan@example.cz",
            position: "Hlavní kontakt",
          },
          {
            id: "p2",
            name: "Petra Svobodová",
            phone: "+420 222 123 456",
            email: "petra@example.cz",
            position: "Obchodní zástupce",
          },
        ],
      }),
    ];

    const rowContact = getRowContactPerson(contacts[0]);
    const additionalContacts = getAdditionalContactPersons(
      contacts[0],
      rowContact,
    );

    expect(rowContact?.name).toBe("Jan Novák");
    expect(additionalContacts).toHaveLength(1);
    expect(additionalContacts[0].name).toBe("Petra Svobodová");
    expect(formatAdditionalContactsTitle(additionalContacts)).toBe(
      "OZ: Petra Svobodová",
    );
  });
});
