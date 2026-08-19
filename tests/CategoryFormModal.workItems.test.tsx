import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryFormModal } from "@features/projects/pipeline/ui/CategoryFormModal";
import { buildUpdatedDemandCategory } from "@features/projects/model/pipelineModel";
import type { DemandCategory } from "@/types";

const originalCategory: DemandCategory = {
  id: "cat-1",
  title: "Elektroinstalace",
  budget: "~0,00 Kč",
  sodBudget: 0,
  planBudget: 0,
  status: "open",
  subcontractorCount: 0,
  description: "",
  workItems: [],
};

const WorkItemsLifecycleHarness = () => {
  const [category, setCategory] = useState(originalCategory);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Znovu otevřít
      </button>
      <CategoryFormModal
        isOpen={isOpen}
        mode="edit"
        initialData={category}
        onClose={() => setIsOpen(false)}
        onSubmit={async (formData) => {
          setCategory(buildUpdatedDemandCategory(category, formData, []));
          setIsOpen(false);
        }}
      />
    </>
  );
};

describe("CategoryFormModal položky popisu prací", () => {
  it("načte popis starší poptávky, pokud má prázdné pole workItems", () => {
    render(
      <CategoryFormModal
        isOpen
        mode="edit"
        initialData={{
          ...originalCategory,
          description: "Silnoproud, MaR, Fotovoltaika",
          workItems: [],
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Silnoproud, MaR, Fotovoltaika")).toBeInTheDocument();
  });

  it("umožní uloženou položku po opětovném otevření upravit", async () => {
    render(<WorkItemsLifecycleHarness />);

    fireEvent.click(screen.getByRole("button", { name: /Přidat položku/ }));
    fireEvent.change(screen.getByPlaceholderText("Popis položky..."), {
      target: { value: "Montáž rozvaděče" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Upravit Poptávku" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Znovu otevřít" }));

    const savedItem = screen.getByDisplayValue("Montáž rozvaděče");
    fireEvent.change(savedItem, {
      target: { value: "Montáž a zapojení rozvaděče" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Upravit Poptávku" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Znovu otevřít" }));

    expect(screen.getByDisplayValue("Montáž a zapojení rozvaděče")).toBeInTheDocument();
  });
});
