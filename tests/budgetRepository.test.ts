import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  table: "",
  filters: [] as Array<{ column: string; value: string }>,
  error: null as { message: string } | null,
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: {
    from: (table: string) => {
      dbState.table = table;
      return {
        delete: () => ({
          eq: (column: string, value: string) => {
            dbState.filters.push({ column, value });
            return {
              eq: async (nextColumn: string, nextValue: string) => {
                dbState.filters.push({ column: nextColumn, value: nextValue });
                return { data: null, error: dbState.error };
              },
            };
          },
        }),
      };
    },
  },
}));

import { budgetRepository } from "@/features/budgets/api/budgetRepository";

describe("budgetRepository", () => {
  beforeEach(() => {
    dbState.table = "";
    dbState.filters = [];
    dbState.error = null;
  });

  it("maže projektový rozpočet jen ve scope konkrétní stavby", async () => {
    await budgetRepository.deleteProjectBudget("project-1", "budget-1");

    expect(dbState.table).toBe("project_budgets");
    expect(dbState.filters).toEqual([
      { column: "id", value: "budget-1" },
      { column: "project_id", value: "project-1" },
    ]);
  });

  it("propaguje chybu databáze při smazání rozpočtu", async () => {
    dbState.error = { message: "delete denied" };

    await expect(budgetRepository.deleteProjectBudget("project-1", "budget-1")).rejects.toEqual({
      message: "delete denied",
    });
  });

  it("maže list jen ve scope konkrétního rozpočtu", async () => {
    await budgetRepository.deleteSheet({ budgetId: "budget-1", sheetId: "sheet-1" });

    expect(dbState.table).toBe("project_budget_sheets");
    expect(dbState.filters).toEqual([
      { column: "id", value: "sheet-1" },
      { column: "budget_id", value: "budget-1" },
    ]);
  });

  it("propaguje chybu databáze při smazání listu", async () => {
    dbState.error = { message: "sheet delete denied" };

    await expect(budgetRepository.deleteSheet({ budgetId: "budget-1", sheetId: "sheet-1" })).rejects.toEqual({
      message: "sheet delete denied",
    });
  });
});
