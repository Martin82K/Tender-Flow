import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectBudgetImportModal } from "@/features/budgets/ui/ProjectBudgetImportModal";
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
});
