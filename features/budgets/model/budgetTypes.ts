export type ProjectBudgetStatus = "draft" | "active" | "locked";

export type ProjectBudgetVatRate = 0 | 12 | 21;

export interface ProjectBudgetMeasurement {
  id: string;
  itemId: string;
  rowNumber: number;
  note: string;
  formula?: string | null;
  result: number;
}

export interface ProjectBudgetItem {
  id: string;
  categoryId: string;
  demandCategoryId?: string | null;
  positionLabel?: string | null;
  code: string;
  name: string;
  unit: string;
  amount: number;
  unitPrice: number;
  vatRate: ProjectBudgetVatRate;
  marginPercent: number;
  totalPrice: number;
  totalPriceWithVat: number;
  marginAmount: number;
  order: number;
  description?: string | null;
  measurements: ProjectBudgetMeasurement[];
}

export interface ProjectBudgetCategory {
  id: string;
  sheetId: string;
  name: string;
  code?: string | null;
  order: number;
  totalPrice: number;
  totalPriceWithVat: number;
  items: ProjectBudgetItem[];
}

export interface ProjectBudgetSheet {
  id: string;
  budgetId: string;
  name: string;
  order: number;
  totalPrice: number;
  totalPriceWithVat: number;
  categories: ProjectBudgetCategory[];
}

export interface ProjectBudget {
  id: string;
  projectId: string;
  name: string;
  status: ProjectBudgetStatus;
  currency: "CZK";
  totalPrice: number;
  totalPriceWithVat: number;
  createdAt?: string;
  updatedAt?: string;
  sheets: ProjectBudgetSheet[];
}

export interface ProjectBudgetItemInput {
  budgetId: string;
  sheetId: string;
  categoryId: string;
  demandCategoryId?: string | null;
  positionLabel?: string | null;
  code: string;
  name: string;
  unit: string;
  amount: number;
  unitPrice: number;
  vatRate: ProjectBudgetVatRate;
  marginPercent: number;
  description?: string | null;
}

export interface ProjectBudgetImportMeasurementInput {
  note: string;
  formula?: string | null;
  result: number;
}

export interface ProjectBudgetImportItemInput {
  sheetName: string;
  categoryName: string;
  code: string;
  name: string;
  unit: string;
  amount: number;
  unitPrice: number;
  vatRate: ProjectBudgetVatRate;
  marginPercent?: number;
  description?: string | null;
  demandCategoryId?: string | null;
  positionLabel?: string | null;
  measurements?: ProjectBudgetImportMeasurementInput[];
}

export type ProjectBudgetImportProgressPhase =
  | "preparing"
  | "sheet"
  | "category"
  | "item"
  | "measurements"
  | "completed";

export interface ProjectBudgetImportProgress {
  phase: ProjectBudgetImportProgressPhase;
  processedItems: number;
  totalItems: number;
  currentItemName?: string;
  currentItemCode?: string;
  currentSheetName?: string;
  currentCategoryName?: string;
  sourceRowNumber?: number;
  message: string;
  timestamp: number;
}

export interface ProjectBudgetImportResult {
  sheetsAdded: number;
  categoriesAdded: number;
  itemsAdded: number;
  measurementsAdded: number;
  skippedRows: number;
  warnings: string[];
}

export interface TenderBudgetSummary {
  demandCategoryId: string;
  itemCount: number;
  totalPrice: number;
  totalPriceWithVat: number;
}
