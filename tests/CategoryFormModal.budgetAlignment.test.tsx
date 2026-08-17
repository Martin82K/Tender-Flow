import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryFormModal } from "@features/projects/pipeline/ui/CategoryFormModal";

vi.mock("@/services/documentService", () => ({
  formatFileSize: vi.fn((size: number) => `${size} B`),
}));

vi.mock("@/services/budgetAttachmentService", () => ({
  selectBudgetAttachment: vi.fn(),
  selectPendingBudgetAttachment: vi.fn(),
}));

vi.mock("@infra/files/fileSystemService", () => ({
  openInExplorer: vi.fn(),
}));

describe("CategoryFormModal zarovnání rozpočtových polí", () => {
  it("používá stejně vysoké hlavičky pro cenu SOD a interní plán", () => {
    render(
      <CategoryFormModal
        isOpen
        mode="edit"
        initialData={{
          title: "Elektroinstalace - Silnoproud",
          sodBudget: 6255743,
          planBudget: 5078846,
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const sodHeader = screen.getByText("Cena SOD (Investor)").parentElement;
    const planHeader = screen.getByText("Interní Plán").parentElement;

    expect(sodHeader).toHaveClass("min-h-7");
    expect(planHeader).toHaveClass("min-h-7");
  });
});
