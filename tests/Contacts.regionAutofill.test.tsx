import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Subcontractor, StatusConfig } from "../types";

const mockState = vi.hoisted(() => ({
  findCompanyRegistrationDetails: vi.fn(),
  onBulkUpdateContacts: vi.fn(),
}));

vi.mock("@/services/geminiService", () => ({
  findCompanyRegistrationDetails: mockState.findCompanyRegistrationDetails,
}));

vi.mock("@/shared/ui/Header", () => ({
  Header: ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  ),
}));

vi.mock("@/shared/ui/StarRating", () => ({
  StarRating: () => <div data-testid="star-rating" />,
}));

vi.mock("@/shared/ui/ConfirmationModal", () => ({
  ConfirmationModal: ({
    isOpen,
    title,
    message,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
  }) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    ) : null,
}));

vi.mock("@/shared/ui/SubcontractorSelector", () => ({
  SubcontractorSelector: ({
    contacts,
    onSelectionChange,
    onFilteredContactsChange,
  }: {
    contacts: Subcontractor[];
    onSelectionChange: (ids: Set<string>) => void;
    onFilteredContactsChange?: (contacts: Subcontractor[]) => void;
  }) => {
    React.useEffect(() => {
      onFilteredContactsChange?.(contacts);
      onSelectionChange(new Set(contacts.map((contact) => contact.id)));
    }, [contacts, onFilteredContactsChange, onSelectionChange]);

    return <div data-testid="subcontractor-selector" />;
  },
}));

import { Contacts } from "../features/contacts/Contacts";

describe("Contacts auto-fill regions", () => {
  const statuses: StatusConfig[] = [{ id: "available", label: "K dispozici", color: "green" }];
  const contacts: Subcontractor[] = [
    {
      id: "c-1",
      company: "Firma A",
      specialization: ["Elektro"],
      contacts: [],
      ico: "12345678",
      region: "-",
      address: "-",
      status: "available",
    },
    {
      id: "c-2",
      company: "Firma B",
      specialization: ["Elektro"],
      contacts: [],
      ico: "87654321",
      region: "Praha",
      address: "Praha 1",
      status: "available",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.onBulkUpdateContacts.mockResolvedValue(undefined);
  });

  it("přeskočí placeholder region a zobrazí informaci, když AI vrátí jen pomlčku", async () => {
    mockState.findCompanyRegistrationDetails.mockResolvedValue({
      "c-1": { region: "-", address: "-" },
    });

    render(
      <Contacts
        statuses={statuses}
        contacts={contacts}
        onContactsChange={vi.fn()}
        onAddContact={vi.fn()}
        onUpdateContact={vi.fn()}
        onBulkUpdateContacts={mockState.onBulkUpdateContacts}
        onDeleteContacts={vi.fn()}
      />,
    );

    const button = await screen.findByRole("button", { name: /doplnit adresy a regiony/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Bez výsledku z ARES: 1",
      );
    });

    expect(mockState.onBulkUpdateContacts).not.toHaveBeenCalled();
  });

  it("uloží jen kontakty s nově dohledaným regionem nebo adresou", async () => {
    mockState.findCompanyRegistrationDetails.mockResolvedValue({
      "c-1": { region: "Praha", address: "Ulice 1, Praha" },
      "c-2": { region: "-", address: "-" },
    });

    render(
      <Contacts
        statuses={statuses}
        contacts={contacts}
        onContactsChange={vi.fn()}
        onAddContact={vi.fn()}
        onUpdateContact={vi.fn()}
        onBulkUpdateContacts={mockState.onBulkUpdateContacts}
        onDeleteContacts={vi.fn()}
      />,
    );

    const button = await screen.findByRole("button", { name: /doplnit adresy a regiony/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockState.onBulkUpdateContacts).toHaveBeenCalledWith([
        expect.objectContaining({ id: "c-1", region: "Praha", address: "Ulice 1, Praha" }),
      ]);
    });

    // Summary modal is shown after completion
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent("Doplněno: 1");
    });
  });

  it("na karte dodavatele dohleda adresu a region podle ICO", async () => {
    mockState.findCompanyRegistrationDetails.mockImplementation(async (items: Array<{ id: string }>) => ({
      [items[0].id]: {
        region: "Karlovarský kraj",
        address: "č.p. 88, 36225 Božičany",
      },
    }));

    render(
      <Contacts
        statuses={statuses}
        contacts={contacts}
        onContactsChange={vi.fn()}
        onAddContact={vi.fn()}
        onUpdateContact={vi.fn()}
        onBulkUpdateContacts={mockState.onBulkUpdateContacts}
        onDeleteContacts={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /pridat kontakt|přidat kontakt/i }));

    fireEvent.change(screen.getByPlaceholderText(/IČO firmy/i), {
      target: { value: "64356221" },
    });
    fireEvent.click(screen.getByTitle(/Dohledat adresu a region dle IČO/i));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Karlovarský kraj")).toBeInTheDocument();
      expect(screen.getByDisplayValue("č.p. 88, 36225 Božičany")).toBeInTheDocument();
    });
  });
});
