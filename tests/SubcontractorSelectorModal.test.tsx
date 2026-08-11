import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubcontractorSelectorModal } from "@features/projects/pipeline";

const mocks = vi.hoisted(() => ({
  selectorProps: vi.fn(),
}));

vi.mock("@shared/ui/SubcontractorSelector", () => ({
  SubcontractorSelector: ({
    onSelectionChange,
    ...props
  }: {
    onSelectionChange: (ids: Set<string>) => void;
    [key: string]: unknown;
  }) => {
    mocks.selectorProps({ onSelectionChange, ...props });
    return (
      <button onClick={() => onSelectionChange(new Set(["supplier-2"]))}>
        Změnit výběr
      </button>
    );
  },
}));

const createProps = () => ({
  isOpen: true,
  isMaximized: false,
  contacts: [],
  statuses: [],
  selectedIds: new Set<string>(),
  onSelectionChange: vi.fn(),
  onToggleMaximize: vi.fn(),
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  onAddContact: vi.fn(),
  onEditContact: vi.fn(),
  projectPosition: null,
});

describe("SubcontractorSelectorModal", () => {
  it("renders nothing while closed", () => {
    const props = createProps();
    const { container } = render(
      <SubcontractorSelectorModal {...props} isOpen={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current selection and disables confirmation when it is empty", () => {
    render(<SubcontractorSelectorModal {...createProps()} />);

    expect(screen.getByText("Vybrat subdodavatele")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Přenést do pipeline" }),
    ).toBeDisabled();
  });

  it("forwards selection and invokes non-destructive modal actions", () => {
    const props = createProps();
    props.selectedIds = new Set(["supplier-1"]);
    render(<SubcontractorSelectorModal {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Změnit výběr" }));
    fireEvent.click(
      screen.getByTitle("Zvětšit na celou obrazovku"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Přenést do pipeline" }),
    );

    expect(props.onSelectionChange).toHaveBeenCalledWith(
      new Set(["supplier-2"]),
    );
    expect(mocks.selectorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        contacts: props.contacts,
        statuses: props.statuses,
        selectedIds: props.selectedIds,
        onAddContact: props.onAddContact,
        onEditContact: props.onEditContact,
        projectPosition: props.projectPosition,
        className: "flex-1 min-h-0",
      }),
    );
    expect(props.onToggleMaximize).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("uses the fullscreen layout when maximized", () => {
    const { container } = render(
      <SubcontractorSelectorModal {...createProps()} isMaximized />,
    );

    expect(
      container.querySelector(
        '[data-help-id="pipeline-subcontractor-selector-modal"] > div',
      ),
    ).toHaveClass("fixed", "inset-0", "rounded-none", "w-full", "h-full");
    expect(screen.getByTitle("Obnovit velikost")).toBeInTheDocument();
  });
});
