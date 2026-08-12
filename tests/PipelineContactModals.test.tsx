import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineContactModals } from "@features/projects/pipeline";
import type { StatusConfig, Subcontractor } from "@/types";

vi.mock("@features/projects/pipeline/ui/SubcontractorSelectorModal", () => ({
  SubcontractorSelectorModal: ({
    onConfirm,
    onToggleMaximize,
  }: {
    onConfirm: () => void;
    onToggleMaximize: () => void;
  }) => (
    <div data-testid="selector-modal">
      <button onClick={onConfirm}>confirm selection</button>
      <button onClick={onToggleMaximize}>toggle maximize</button>
    </div>
  ),
}));

vi.mock("@features/projects/pipeline/ui/CreateContactModal", () => ({
  CreateContactModal: ({
    initialData,
    onSave,
  }: {
    initialData?: Subcontractor;
    onSave: (contact: Subcontractor) => void;
  }) => (
    <div data-testid="contact-modal">
      <span>{initialData ? `edit ${initialData.company}` : "create contact"}</span>
      <button onClick={() => onSave(initialData || contact)}>save contact</button>
    </div>
  ),
}));

const contact = {
  id: "contact-1",
  company: "Dodavatel s.r.o.",
  specialization: ["Elektro"],
} as Subcontractor;

const statuses = [{ id: "available", label: "Dostupný" }] as StatusConfig[];

const createProps = () => ({
  isSelectorOpen: true,
  isSelectorMaximized: false,
  contacts: [contact],
  selectorStatuses: statuses,
  contactStatuses: statuses,
  selectedIds: new Set<string>([contact.id]),
  onSelectionChange: vi.fn(),
  onToggleSelectorMaximize: vi.fn(),
  onCloseSelector: vi.fn(),
  onConfirmSelection: vi.fn(),
  onAddContact: vi.fn(),
  onEditContact: vi.fn(),
  projectPosition: { lat: 50.08, lng: 14.43 },
  isCreateContactOpen: false,
  newContactName: "Nový dodavatel",
  editingContact: null,
  existingSpecializations: ["Elektro"],
  onCloseContact: vi.fn(),
  onSaveNewContact: vi.fn(),
  onUpdateContact: vi.fn(),
});

describe("PipelineContactModals", () => {
  it("předává akce výběru subdodavatelů beze změny", () => {
    const props = createProps();

    render(<PipelineContactModals {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "confirm selection" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle maximize" }));

    expect(props.onConfirmSelection).toHaveBeenCalledTimes(1);
    expect(props.onToggleSelectorMaximize).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("contact-modal")).not.toBeInTheDocument();
  });

  it("použije update callback při editaci existujícího kontaktu", () => {
    const props = createProps();

    render(
      <PipelineContactModals
        {...props}
        editingContact={contact}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "save contact" }));

    expect(screen.getByText("edit Dodavatel s.r.o.")).toBeInTheDocument();
    expect(props.onUpdateContact).toHaveBeenCalledWith(contact);
    expect(props.onSaveNewContact).not.toHaveBeenCalled();
  });
});
