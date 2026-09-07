import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@shared/ui/SubcontractorSelector", () => ({ SubcontractorSelector: () => <div>Výběr kontaktů</div> }));
import { SubcontractorSelectorModal } from "@features/projects/pipeline/ui/SubcontractorSelectorModal";

it("shows progress and blocks confirmation, closing and changing selection while saving", () => {
  const confirm = vi.fn(); const close = vi.fn();
  render(<SubcontractorSelectorModal isOpen isMaximized isSubmitting contacts={[]} statuses={[]}
    selectedIds={new Set(["supplier"])} onSelectionChange={vi.fn()} onToggleMaximize={vi.fn()}
    onClose={close} onConfirm={confirm} onAddContact={vi.fn()} onEditContact={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Přidávám…" });
  expect(button).toBeDisabled();
  expect(screen.getByRole("button", { name: "Zrušit" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Zavřít výběr dodavatelů" })).toBeDisabled();
  expect(screen.getByText("Výběr kontaktů").parentElement).toHaveAttribute("inert");
  fireEvent.click(button); fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
  expect(confirm).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});
