import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Subcontractor, StatusConfig } from "../types";

const mockState = vi.hoisted(() => ({
  findCompanyRegions: vi.fn(),
  onBulkUpdateContacts: vi.fn(),
}));

vi.mock("@/services/geminiService", () => ({
  findCompanyRegions: mockState.findCompanyRegions,
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
      status: "available",
    },
    {
      id: "c-2",
      company: "Firma B",
      specialization: ["Elektro"],
      contacts: [],
      ico: "87654321",
      region: "Praha",
      status: "available",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.onBulkUpdateContacts.mockResolvedValue(undefined);
  });

  it("přeskočí placeholder region a zobrazí informaci, když AI vrátí jen pomlčku", async () => {
    mockState.findCompanyRegions.mockResolvedValue({ "c-1": "-" });

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

    const button = await screen.findByRole("button", { name: /doplnit regiony/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Firma může existovat, ale region se nepodařilo spolehlivě dohledat",
      );
    });

    expect(mockState.onBulkUpdateContacts).not.toHaveBeenCalled();
  });

  it("uloží jen kontakty s nově dohledaným regionem", async () => {
    mockState.findCompanyRegions.mockResolvedValue({ "c-1": "Praha", "c-2": "-" });

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

    const button = await screen.findByRole("button", { name: /doplnit regiony/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockState.onBulkUpdateContacts).toHaveBeenCalledTimes(1);
    });

    expect(mockState.onBulkUpdateContacts).toHaveBeenCalledWith([
      expect.objectContaining({ id: "c-1", region: "Praha" }),
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
