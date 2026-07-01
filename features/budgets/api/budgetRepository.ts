import { dbAdapter } from "@infra/db/dbAdapter";
import type {
  ProjectBudget,
  ProjectBudgetCategory,
  ProjectBudgetImportItemInput,
  ProjectBudgetImportProgress,
  ProjectBudgetImportResult,
  ProjectBudgetItem,
  ProjectBudgetItemInput,
  ProjectBudgetMeasurement,
  ProjectBudgetSheet,
  ProjectBudgetVatRate,
} from "../model/budgetTypes";
import { withBudgetItemPricing } from "../model/budgetPricing";
import { summarizeBudget } from "../model/budgetSummary";

interface BudgetRow {
  id: string;
  project_id: string;
  name: string;
  status: "draft" | "active" | "locked" | null;
  currency: "CZK" | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SheetRow {
  id: string;
  budget_id: string;
  name: string;
  sort_order: number | null;
}

interface CategoryRow {
  id: string;
  sheet_id: string;
  name: string;
  code: string | null;
  sort_order: number | null;
}

interface ItemRow {
  id: string;
  category_id: string;
  demand_category_id: string | null;
  position_label: string | null;
  code: string | null;
  name: string;
  unit: string | null;
  amount: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  margin_percent: number | null;
  description: string | null;
  sort_order: number | null;
}

interface MeasurementRow {
  id: string;
  item_id: string;
  row_number: number | null;
  note: string | null;
  formula: string | null;
  result: number | null;
}

export const createProjectBudgetId = () =>
  `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toVatRate = (value: number | null): ProjectBudgetVatRate =>
  value === 0 || value === 12 || value === 21 ? value : 21;

export const mapBudgetRows = (input: {
  budget: BudgetRow;
  sheets: SheetRow[];
  categories: CategoryRow[];
  items: ItemRow[];
  measurements: MeasurementRow[];
}): ProjectBudget => {
  const measurementsByItem = new Map<string, ProjectBudgetMeasurement[]>();
  input.measurements.forEach((row) => {
    const list = measurementsByItem.get(row.item_id) ?? [];
    list.push({
      id: row.id,
      itemId: row.item_id,
      rowNumber: row.row_number ?? list.length + 1,
      note: row.note ?? "",
      formula: row.formula,
      result: row.result ?? 0,
    });
    measurementsByItem.set(row.item_id, list);
  });

  const itemsByCategory = new Map<string, ProjectBudgetItem[]>();
  input.items.forEach((row) => {
    const list = itemsByCategory.get(row.category_id) ?? [];
    list.push(
      withBudgetItemPricing({
        id: row.id,
        categoryId: row.category_id,
        demandCategoryId: row.demand_category_id,
        positionLabel: row.position_label,
        code: row.code ?? "",
        name: row.name,
        unit: row.unit ?? "ks",
        amount: row.amount ?? 0,
        unitPrice: row.unit_price ?? 0,
        vatRate: toVatRate(row.vat_rate),
        marginPercent: row.margin_percent ?? 0,
        order: row.sort_order ?? list.length,
        description: row.description,
        measurements: (measurementsByItem.get(row.id) ?? []).sort(
          (a, b) => a.rowNumber - b.rowNumber,
        ),
      }),
    );
    itemsByCategory.set(row.category_id, list);
  });

  const categoriesBySheet = new Map<string, ProjectBudgetCategory[]>();
  input.categories.forEach((row) => {
    const items = (itemsByCategory.get(row.id) ?? []).sort((a, b) => a.order - b.order);
    const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalPriceWithVat = items.reduce((sum, item) => sum + item.totalPriceWithVat, 0);
    const list = categoriesBySheet.get(row.sheet_id) ?? [];
    list.push({
      id: row.id,
      sheetId: row.sheet_id,
      name: row.name,
      code: row.code,
      order: row.sort_order ?? list.length,
      totalPrice,
      totalPriceWithVat,
      items,
    });
    categoriesBySheet.set(row.sheet_id, list);
  });

  const sheets: ProjectBudgetSheet[] = input.sheets
    .map((row, index) => {
      const categories = (categoriesBySheet.get(row.id) ?? []).sort((a, b) => a.order - b.order);
      return {
        id: row.id,
        budgetId: row.budget_id,
        name: row.name,
        order: row.sort_order ?? index,
        totalPrice: categories.reduce((sum, category) => sum + category.totalPrice, 0),
        totalPriceWithVat: categories.reduce((sum, category) => sum + category.totalPriceWithVat, 0),
        categories,
      };
    })
    .sort((a, b) => a.order - b.order);

  const budget: ProjectBudget = {
    id: input.budget.id,
    projectId: input.budget.project_id,
    name: input.budget.name,
    status: input.budget.status ?? "draft",
    currency: input.budget.currency ?? "CZK",
    totalPrice: 0,
    totalPriceWithVat: 0,
    createdAt: input.budget.created_at ?? undefined,
    updatedAt: input.budget.updated_at ?? undefined,
    sheets,
  };

  const summary = summarizeBudget(budget);
  return {
    ...budget,
    totalPrice: summary.totalPrice,
    totalPriceWithVat: summary.totalPriceWithVat,
  };
};

const defaultBudgetName = (projectTitle?: string) =>
  projectTitle ? `Rozpočet - ${projectTitle}` : "Projektový rozpočet";

export const budgetRepository = {
  async getOrCreateProjectBudget(projectId: string, projectTitle?: string): Promise<ProjectBudget> {
    const { data: existing, error: existingError } = await dbAdapter
      .from("project_budgets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      const budgetId = createProjectBudgetId();
      const sheetId = `${budgetId}_sheet_1`;

      const { error: budgetError } = await dbAdapter.from("project_budgets").insert({
        id: budgetId,
        project_id: projectId,
        name: defaultBudgetName(projectTitle),
        status: "draft",
        currency: "CZK",
      });
      if (budgetError) throw budgetError;

      const { error: sheetError } = await dbAdapter.from("project_budget_sheets").insert({
        id: sheetId,
        budget_id: budgetId,
        name: "SO 01",
        sort_order: 0,
      });
      if (sheetError) throw sheetError;
    }

    return budgetRepository.getProjectBudget(projectId);
  },

  async getProjectBudget(projectId: string): Promise<ProjectBudget> {
    const { data: budget, error: budgetError } = await dbAdapter
      .from("project_budgets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (budgetError) throw budgetError;
    if (!budget) {
      throw new Error("Project budget does not exist.");
    }

    const [sheetsRes, categoriesRes, itemsRes] = await Promise.all([
      dbAdapter.from("project_budget_sheets").select("*").eq("budget_id", budget.id),
      dbAdapter
        .from("project_budget_categories")
        .select("*, project_budget_sheets!inner(budget_id)")
        .eq("project_budget_sheets.budget_id", budget.id),
      dbAdapter
        .from("project_budget_items")
        .select("*, project_budget_categories!inner(project_budget_sheets!inner(budget_id))")
        .eq("project_budget_categories.project_budget_sheets.budget_id", budget.id),
    ]);

    if (sheetsRes.error) throw sheetsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (itemsRes.error) throw itemsRes.error;

    const itemIds = ((itemsRes.data || []) as ItemRow[]).map((item) => item.id);
    let measurements: MeasurementRow[] = [];
    if (itemIds.length > 0) {
      const measurementsRes = await dbAdapter
        .from("project_budget_measurements")
        .select("*")
        .in("item_id", itemIds);
      if (measurementsRes.error) throw measurementsRes.error;
      measurements = (measurementsRes.data || []) as MeasurementRow[];
    }

    return mapBudgetRows({
      budget: budget as BudgetRow,
      sheets: (sheetsRes.data || []) as SheetRow[],
      categories: (categoriesRes.data || []) as CategoryRow[],
      items: (itemsRes.data || []) as ItemRow[],
      measurements,
    });
  },

  async getProjectBudgetById(budgetId: string): Promise<ProjectBudget> {
    const { data: budget, error: budgetError } = await dbAdapter
      .from("project_budgets")
      .select("*")
      .eq("id", budgetId)
      .maybeSingle();

    if (budgetError) throw budgetError;
    if (!budget) {
      throw new Error("Project budget does not exist.");
    }

    const [sheetsRes, categoriesRes, itemsRes] = await Promise.all([
      dbAdapter.from("project_budget_sheets").select("*").eq("budget_id", budgetId),
      dbAdapter
        .from("project_budget_categories")
        .select("*, project_budget_sheets!inner(budget_id)")
        .eq("project_budget_sheets.budget_id", budgetId),
      dbAdapter
        .from("project_budget_items")
        .select("*, project_budget_categories!inner(project_budget_sheets!inner(budget_id))")
        .eq("project_budget_categories.project_budget_sheets.budget_id", budgetId),
    ]);

    if (sheetsRes.error) throw sheetsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (itemsRes.error) throw itemsRes.error;

    const itemIds = ((itemsRes.data || []) as ItemRow[]).map((item) => item.id);
    let measurements: MeasurementRow[] = [];
    if (itemIds.length > 0) {
      const measurementsRes = await dbAdapter
        .from("project_budget_measurements")
        .select("*")
        .in("item_id", itemIds);
      if (measurementsRes.error) throw measurementsRes.error;
      measurements = (measurementsRes.data || []) as MeasurementRow[];
    }

    return mapBudgetRows({
      budget: budget as BudgetRow,
      sheets: (sheetsRes.data || []) as SheetRow[],
      categories: (categoriesRes.data || []) as CategoryRow[],
      items: (itemsRes.data || []) as ItemRow[],
      measurements,
    });
  },

  async createItem(input: ProjectBudgetItemInput): Promise<void> {
    const id = `pbi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: siblings, error: countError } = await dbAdapter
      .from("project_budget_items")
      .select("id")
      .eq("category_id", input.categoryId);

    if (countError) throw countError;

    const { error } = await dbAdapter.from("project_budget_items").insert({
      id,
      category_id: input.categoryId,
      demand_category_id: input.demandCategoryId || null,
      position_label: input.positionLabel?.trim() || null,
      code: input.code.trim() || null,
      name: input.name.trim(),
      unit: input.unit.trim() || "ks",
      amount: input.amount,
      unit_price: input.unitPrice,
      vat_rate: input.vatRate,
      margin_percent: input.marginPercent,
      description: input.description?.trim() || null,
      sort_order: siblings?.length ?? 0,
    });
    if (error) throw error;
  },

  async createSheet(input: { budgetId: string; name: string }): Promise<void> {
    const id = `pbs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: siblings, error: countError } = await dbAdapter
      .from("project_budget_sheets")
      .select("id")
      .eq("budget_id", input.budgetId);

    if (countError) throw countError;

    const { error: sheetError } = await dbAdapter.from("project_budget_sheets").insert({
      id,
      budget_id: input.budgetId,
      name: input.name.trim() || `SO ${(siblings?.length ?? 0) + 1}`,
      sort_order: siblings?.length ?? 0,
    });
    if (sheetError) throw sheetError;
  },

  async createCategory(input: { sheetId: string; name: string; code?: string | null }): Promise<void> {
    const id = `pbc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: siblings, error: countError } = await dbAdapter
      .from("project_budget_categories")
      .select("id")
      .eq("sheet_id", input.sheetId);

    if (countError) throw countError;

    const { error } = await dbAdapter.from("project_budget_categories").insert({
      id,
      sheet_id: input.sheetId,
      name: input.name.trim() || `Oddíl ${(siblings?.length ?? 0) + 1}`,
      code: input.code?.trim() || null,
      sort_order: siblings?.length ?? 0,
    });
    if (error) throw error;
  },

  async importItems(input: {
    budgetId: string;
    items: ProjectBudgetImportItemInput[];
    onProgress?: (progress: ProjectBudgetImportProgress) => void;
  }): Promise<ProjectBudgetImportResult> {
    const emitProgress = (progress: Omit<ProjectBudgetImportProgress, "timestamp" | "totalItems">) => {
      input.onProgress?.({
        ...progress,
        totalItems: input.items.length,
        timestamp: Date.now(),
      });
    };

    const sourceRowNumberOf = (item: ProjectBudgetImportItemInput): number | undefined => {
      const maybeRow = (item as { sourceRowNumber?: unknown }).sourceRowNumber;
      return typeof maybeRow === "number" ? maybeRow : undefined;
    };

    emitProgress({
      phase: "preparing",
      processedItems: 0,
      message: "Načítám aktuální rozpočet před importem.",
    });

    const current = await budgetRepository.getProjectBudgetById(input.budgetId);
    const sheetByName = new Map(current.sheets.map((sheet) => [sheet.name.trim().toLowerCase(), sheet]));
    const categoryBySheetAndName = new Map<string, ProjectBudgetCategory>();

    current.sheets.forEach((sheet) => {
      sheet.categories.forEach((category) => {
        categoryBySheetAndName.set(`${sheet.id}:${category.name.trim().toLowerCase()}`, category);
      });
    });

    let sheetsAdded = 0;
    let categoriesAdded = 0;
    let itemsAdded = 0;
    let measurementsAdded = 0;
    let skippedRows = 0;
    const warnings: string[] = [];

    const existingItemCountsByCategory = new Map<string, number>();
    current.sheets.forEach((sheet) => {
      sheet.categories.forEach((category) => {
        existingItemCountsByCategory.set(category.id, category.items.length);
      });
    });

    for (const item of input.items) {
      const itemName = item.name.trim();
      if (!itemName) {
        skippedRows++;
        continue;
      }

      emitProgress({
        phase: "item",
        processedItems: itemsAdded,
        currentItemName: itemName,
        currentItemCode: item.code.trim() || undefined,
        currentSheetName: item.sheetName.trim() || "Importované objekty",
        currentCategoryName: item.categoryName.trim() || "Importované položky",
        sourceRowNumber: sourceRowNumberOf(item),
        message: `Ukládám položku ${itemsAdded + 1}/${input.items.length}.`,
      });

      const sheetName = item.sheetName.trim() || "Importované objekty";
      const sheetKey = sheetName.toLowerCase();
      let sheet = sheetByName.get(sheetKey);
      if (!sheet) {
        emitProgress({
          phase: "sheet",
          processedItems: itemsAdded,
          currentItemName: itemName,
          currentItemCode: item.code.trim() || undefined,
          currentSheetName: sheetName,
          currentCategoryName: item.categoryName.trim() || "Importované položky",
          sourceRowNumber: sourceRowNumberOf(item),
          message: `Zakládám objekt ${sheetName}.`,
        });
        const sheetId = `pbs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await dbAdapter.from("project_budget_sheets").insert({
          id: sheetId,
          budget_id: input.budgetId,
          name: sheetName,
          sort_order: sheetByName.size,
        });
        if (error) throw error;
        sheet = {
          id: sheetId,
          budgetId: input.budgetId,
          name: sheetName,
          order: sheetByName.size,
          totalPrice: 0,
          totalPriceWithVat: 0,
          categories: [],
        };
        sheetByName.set(sheetKey, sheet);
        sheetsAdded++;
      }

      const categoryName = item.categoryName.trim() || "Importované položky";
      const categoryKey = `${sheet.id}:${categoryName.toLowerCase()}`;
      let category = categoryBySheetAndName.get(categoryKey);
      if (!category) {
        emitProgress({
          phase: "category",
          processedItems: itemsAdded,
          currentItemName: itemName,
          currentItemCode: item.code.trim() || undefined,
          currentSheetName: sheetName,
          currentCategoryName: categoryName,
          sourceRowNumber: sourceRowNumberOf(item),
          message: `Zakládám kapitolu ${categoryName}.`,
        });
        const categoryId = `pbc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await dbAdapter.from("project_budget_categories").insert({
          id: categoryId,
          sheet_id: sheet.id,
          name: categoryName,
          code: null,
          sort_order: sheet.categories.length,
        });
        if (error) throw error;
        category = {
          id: categoryId,
          sheetId: sheet.id,
          name: categoryName,
          order: sheet.categories.length,
          totalPrice: 0,
          totalPriceWithVat: 0,
          items: [],
        };
        sheet.categories.push(category);
        categoryBySheetAndName.set(categoryKey, category);
        existingItemCountsByCategory.set(category.id, 0);
        categoriesAdded++;
      }

      const itemId = `pbi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const sortOrder = existingItemCountsByCategory.get(category.id) ?? 0;
      const { error: itemError } = await dbAdapter.from("project_budget_items").insert({
        id: itemId,
        category_id: category.id,
        demand_category_id: item.demandCategoryId || null,
        position_label: item.positionLabel?.trim() || null,
        code: item.code.trim() || null,
        name: itemName,
        unit: item.unit.trim() || "ks",
        amount: item.amount,
        unit_price: item.unitPrice,
        vat_rate: item.vatRate,
        margin_percent: item.marginPercent ?? 0,
        description: item.description?.trim() || null,
        sort_order: sortOrder,
      });
      if (itemError) throw itemError;
      existingItemCountsByCategory.set(category.id, sortOrder + 1);
      itemsAdded++;

      const measurements = item.measurements ?? [];
      if (measurements.length > 0) {
        emitProgress({
          phase: "measurements",
          processedItems: itemsAdded,
          currentItemName: itemName,
          currentItemCode: item.code.trim() || undefined,
          currentSheetName: sheetName,
          currentCategoryName: categoryName,
          sourceRowNumber: sourceRowNumberOf(item),
          message: `Ukládám ${measurements.length.toLocaleString("cs-CZ")} řádků výkazu výměr.`,
        });
        const rows = measurements.map((measurement, index) => ({
          id: `pbm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${index}`,
          item_id: itemId,
          row_number: index + 1,
          note: measurement.note.trim() || `VV ${index + 1}`,
          formula: measurement.formula?.trim() || null,
          result: measurement.result,
        }));
        const { error: measurementError } = await dbAdapter.from("project_budget_measurements").insert(rows);
        if (measurementError) throw measurementError;
        measurementsAdded += rows.length;
      }

      emitProgress({
        phase: "item",
        processedItems: itemsAdded,
        currentItemName: itemName,
        currentItemCode: item.code.trim() || undefined,
        currentSheetName: sheetName,
        currentCategoryName: categoryName,
        sourceRowNumber: sourceRowNumberOf(item),
        message: `Položka ${itemsAdded}/${input.items.length} je uložená.`,
      });
    }

    emitProgress({
      phase: "completed",
      processedItems: itemsAdded,
      message: `Import dokončen: uloženo ${itemsAdded.toLocaleString("cs-CZ")} položek.`,
    });

    return {
      sheetsAdded,
      categoriesAdded,
      itemsAdded,
      measurementsAdded,
      skippedRows,
      warnings,
    };
  },

  async updateItemTender(itemId: string, demandCategoryId: string | null): Promise<void> {
    const { error } = await dbAdapter
      .from("project_budget_items")
      .update({ demand_category_id: demandCategoryId })
      .eq("id", itemId);
    if (error) throw error;
  },

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await dbAdapter.from("project_budget_items").delete().eq("id", itemId);
    if (error) throw error;
  },

  async deleteSheet(input: { budgetId: string; sheetId: string }): Promise<void> {
    const { error } = await dbAdapter
      .from("project_budget_sheets")
      .delete()
      .eq("id", input.sheetId)
      .eq("budget_id", input.budgetId);
    if (error) throw error;
  },

  async deleteProjectBudget(projectId: string, budgetId: string): Promise<void> {
    const { error } = await dbAdapter
      .from("project_budgets")
      .delete()
      .eq("id", budgetId)
      .eq("project_id", projectId);
    if (error) throw error;
  },
};
