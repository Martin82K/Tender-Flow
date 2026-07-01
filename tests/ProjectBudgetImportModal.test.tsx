import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectBudgetImportModal } from "@/features/budgets/ui/ProjectBudgetImportModal";
import type { ProjectBudgetImportRunView } from "@/features/budgets/ui/ProjectBudgetImportModal";
import type { ParsedBudgetImport } from "@/features/budgets/api";

const preview: ParsedBudgetImport = {
  fileName: "rozpocet.xlsx",
  sheetNames: ["SO 01"],
  rows: [
    {
      sourceRowNumber: 3,
      sheetName: "SO 01",
      categoryName: "1 - Zemní práce",
      positionLabel: "1",
      code: "11328",
      name: "Odstranění příkopů",
      unit: "m",
      amount: 12.5,
      unitPrice: 1150,
      vatRate: 21,
      marginPercent: 0,
      description: null,
      measurements: [],
    },
  ],
  totalRows: 3,
  skippedRows: 2,
  skippedRowDetails: [
    {
      sheetName: "SO 01",
      rowNumber: 2,
      reason: "Řádek je hlavička kapitoly, ne položka rozpočtu.",
      values: ["Díl", "1 - Zemní práce"],
    },
    {
      sheetName: "SO 01",
      rowNumber: 4,
      reason: 'Typ řádku "X" není položka rozpočtu.',
      values: ["X", "neimportovatelný typ"],
    },
  ],
  mappedColumns: {
    code: "Kód položky",
    name: "Název položky",
  },
  mappedColumnIndices: {
    code: 0,
    name: 1,
  },
  headerRow: ["Kód položky", "Název položky", "MJ", "Množství", "J. cena"],
  headerRowNumber: 1,
  headerSheetName: "SO 01",
  warnings: [],
};

describe("ProjectBudgetImportModal", () => {
  it("zobrazuje přehled neimportovaných řádků a čitelnou preview tabulku", () => {
    render(
      <ProjectBudgetImportModal
        isOpen
        preview={preview}
        columnOverrides={{}}
        isParsing={false}
        isImporting={false}
        importRun={null}
        error={null}
        onRemapColumn={vi.fn()}
        onResetMapping={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Přehled neimportovaných řádků")).toBeInTheDocument();
    expect(screen.getByText("2 přeskočeno")).toBeInTheDocument();
    expect(screen.getByText("1x Řádek je hlavička kapitoly, ne položka rozpočtu.")).toBeInTheDocument();
    expect(screen.getByText('1x Typ řádku "X" není položka rozpočtu.')).toBeInTheDocument();
    expect(screen.getByText("Díl | 1 - Zemní práce")).toBeInTheDocument();
    expect(screen.getByText("X | neimportovatelný typ")).toBeInTheDocument();

    const previewTable = Array.from(document.body.querySelectorAll("table"))
      .find((table) => table.textContent?.includes("Odstranění příkopů"));
    expect(previewTable).toBeInTheDocument();
    expect(previewTable?.className).toContain("min-w-[1180px]");
  });

  it("zobrazuje detailní průběh běžícího importu", () => {
    const importRun: ProjectBudgetImportRunView = {
      status: "running",
      elapsedSeconds: 14,
      secondsSinceLastUpdate: 2,
      progress: {
        phase: "item",
        processedItems: 18,
        totalItems: 77,
        currentItemName: "Odstranění příkopů",
        currentItemCode: "11328",
        currentSheetName: "SO 01",
        currentCategoryName: "1 - Zemní práce",
        sourceRowNumber: 42,
        message: "Ukládám položku 19/77.",
        timestamp: 1000,
      },
      events: [
        {
          id: 1,
          label: "Ukládám položku 19/77.",
          detail: "SO 01 · 1 - Zemní práce · kód 11328 · řádek 42",
          tone: "info",
        },
      ],
    };

    render(
      <ProjectBudgetImportModal
        isOpen
        preview={preview}
        columnOverrides={{}}
        isParsing={false}
        isImporting
        importRun={importRun}
        error={null}
        onRemapColumn={vi.fn()}
        onResetMapping={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Průběh importu")).toBeInTheDocument();
    expect(screen.getByText("Běží")).toBeInTheDocument();
    expect(screen.getAllByText("Ukládám položku 19/77.").length).toBeGreaterThan(0);
    expect(screen.getByText("18 / 77")).toBeInTheDocument();
    expect(screen.getAllByText("Odstranění příkopů").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SO 01 · 1 - Zemní práce · kód 11328 · řádek 42").length).toBeGreaterThan(0);
    expect(screen.getByText("14s")).toBeInTheDocument();
    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Průběh importu položek" })).toHaveAttribute("aria-valuenow", "18");
  });
});
