import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Columns3,
  Download,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Unlock,
} from "lucide-react";
import type { DemandCategory, ProjectDetails } from "@/types";
import {
  exportBudgetToXlsx,
  exportBudgetTenderToXlsx,
  formatBudgetImportReport,
  parseBudgetImportFile,
  useCreateBudgetCategoryMutation,
  useCreateBudgetItemMutation,
  useCreateBudgetSheetMutation,
  useDeleteBudgetSheetMutation,
  useDeleteProjectBudgetMutation,
  useDeleteBudgetItemMutation,
  useImportBudgetItemsMutation,
  useProjectBudgetQuery,
  useUpdateBudgetItemTenderMutation,
} from "../api";
import type {
  BudgetImportColumnField,
  BudgetImportColumnOverrides,
  ParsedBudgetImport,
} from "../api";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal";
import { ProjectBudgetImportModal } from "./ProjectBudgetImportModal";
import { getTenderPlans } from "@/features/projects/api/tenderPlanApi";
import type {
  ProjectBudget,
  ProjectBudgetCategory,
  ProjectBudgetItem,
  ProjectBudgetVatRate,
} from "../model/budgetTypes";
import { flattenBudgetItems, summarizeBudget, summarizeBudgetByTender } from "../model/budgetSummary";
import { formatBudgetCurrency, parseBudgetNumber } from "../model/budgetFormat";
import { buildBudgetTenderOptions, type BudgetTenderOption } from "../model/budgetTenderOptions";
import { filterDisplayBudgetCategories } from "../model/budgetPlaceholders";
import type { TenderPlanItem } from "@/types";

interface ProjectBudgetTabProps {
  projectId: string;
  project: ProjectDetails;
}

interface ItemFormState {
  code: string;
  name: string;
  unit: string;
  amount: string;
  unitPrice: string;
  vatRate: ProjectBudgetVatRate;
  marginPercent: string;
  demandCategoryId: string;
  description: string;
}

interface SheetContextMenuState {
  sheetId: string;
  sheetName: string;
  x: number;
  y: number;
}

interface BudgetContextMenuState {
  x: number;
  y: number;
}

const initialForm: ItemFormState = {
  code: "",
  name: "",
  unit: "ks",
  amount: "1",
  unitPrice: "0",
  vatRate: 21,
  marginPercent: "0",
  demandCategoryId: "",
  description: "",
};

const headerCellClass =
  "sticky top-0 z-20 bg-[var(--tf-skin-surface-muted)] px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)] shadow-[inset_0_-1px_0_var(--tf-skin-text)]";

const toolbarButtonClass =
  "inline-flex h-7 items-center gap-1.5 border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-2.5 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--tf-skin-text-2)] transition hover:border-[var(--tf-skin-orange)] hover:text-[var(--tf-skin-text)] disabled:cursor-not-allowed disabled:opacity-40";

const darkToolbarButtonClass =
  "inline-flex h-7 items-center gap-1.5 border border-[var(--tf-skin-orange)] bg-[var(--tf-skin-orange)] px-2.5 text-[9px] font-black uppercase tracking-[0.11em] text-white transition hover:bg-[var(--tf-skin-orange-deep)] disabled:cursor-not-allowed disabled:opacity-40";

const compactInputClass =
  "h-7 w-full border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-2 text-[11px] font-semibold text-[var(--tf-skin-text)] outline-none focus:border-[var(--tf-skin-orange)] focus:ring-1 focus:ring-[var(--tf-skin-orange)]";

const menuButtonClass =
  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.08em] text-[var(--tf-skin-text-2)] hover:bg-[color-mix(in_srgb,var(--tf-skin-orange)_8%,var(--tf-skin-card)_92%)]";

const menuPanelClass =
  "absolute top-full z-50 mt-1 overflow-hidden border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] shadow-[0_14px_32px_rgba(0,0,0,0.18)]";

const contextMenuClass =
  "fixed z-50 overflow-hidden border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]";

const getTenderTitle = (options: BudgetTenderOption[], id?: string | null) =>
  options.find((option) => option.id === id)?.title ?? "Bez řízení";

const vatAmountFor = (item: ProjectBudgetItem) => item.totalPriceWithVat - item.totalPrice;

type BudgetColumnKey =
  | "select"
  | "position"
  | "code"
  | "description"
  | "tender"
  | "source"
  | "unit"
  | "amount"
  | "unitPrice"
  | "total"
  | "vat"
  | "margin"
  | "actions";

type BudgetViewKey = "default" | "pricing" | "tender";

interface BudgetViewPreset {
  key: BudgetViewKey;
  label: string;
  hint: string;
  columns: BudgetColumnKey[];
}

const BUDGET_VIEW_PRESETS: BudgetViewPreset[] = [
  {
    key: "default",
    label: "Výchozí pohled",
    hint: "Kompletní rozpočet",
    columns: ["select", "position", "code", "description", "tender", "source", "unit", "amount", "unitPrice", "total", "vat", "margin", "actions"],
  },
  {
    key: "pricing",
    label: "Cenový pohled",
    hint: "Množství a ceny",
    columns: ["select", "position", "code", "description", "unit", "amount", "unitPrice", "total", "vat", "margin", "actions"],
  },
  {
    key: "tender",
    label: "Zadání VŘ",
    hint: "Položky a řízení",
    columns: ["select", "position", "code", "description", "tender", "unit", "amount", "total", "actions"],
  },
];

const COLUMN_WIDTHS: Record<BudgetColumnKey, string> = {
  select: "w-8",
  position: "w-12",
  code: "w-24",
  description: "min-w-[330px]",
  tender: "w-44",
  source: "w-16 text-center",
  unit: "w-12 text-center",
  amount: "w-24 text-right",
  unitPrice: "w-28 text-right",
  total: "w-32 text-right",
  vat: "w-16 text-center",
  margin: "w-16 text-center",
  actions: "w-14 text-right",
};

const getBudgetView = (viewKey: BudgetViewKey) =>
  BUDGET_VIEW_PRESETS.find((view) => view.key === viewKey) ?? BUDGET_VIEW_PRESETS[0];

const createDemoBudget = (projectId: string, project: ProjectDetails): ProjectBudget => {
  const tenderIds = (project.categories || []).map((category) => category.id);
  const items: ProjectBudgetItem[] = [
    {
      id: "demo-budget-item-1",
      categoryId: "demo-budget-cat-1",
      demandCategoryId: tenderIds[0] ?? null,
      code: "014101",
      name: "Poplatky za skládku",
      unit: "ks",
      amount: 965.942,
      unitPrice: 350,
      vatRate: 21,
      marginPercent: 0,
      totalPrice: 338079.7,
      totalPriceWithVat: 409076.44,
      marginAmount: 0,
      order: 0,
      description: "Odvezení a uložení stavební suti na řízenou skládku.",
      measurements: [],
    },
    {
      id: "demo-budget-item-2",
      categoryId: "demo-budget-cat-2",
      demandCategoryId: tenderIds[1] ?? tenderIds[0] ?? null,
      code: "11328",
      name: "Odstranění příkopů, žlabů a rigolů z příkopových tvárnic",
      unit: "ks",
      amount: 40.6,
      unitPrice: 1150,
      vatRate: 21,
      marginPercent: 0,
      totalPrice: 46690,
      totalPriceWithVat: 56594.9,
      marginAmount: 0,
      order: 0,
      description: "Demontáž a odvoz stávajících betonových prvků.",
      measurements: [
        {
          id: "demo-measurement-1",
          itemId: "demo-budget-item-2",
          rowNumber: 1,
          note: "odečteno z CAD: km 1.870-2.100",
          formula: "22.5 + 0.9 + 0.065 - 13.186",
          result: 40.6,
        },
      ],
    },
    {
      id: "demo-budget-item-3",
      categoryId: "demo-budget-cat-2",
      demandCategoryId: tenderIds[1] ?? tenderIds[0] ?? null,
      code: "11333",
      name: "Odstranění podkladu zpevněných ploch z kameniva nestmeleného",
      unit: "ks",
      amount: 48.6299,
      unitPrice: 1430,
      vatRate: 21,
      marginPercent: 0,
      totalPrice: 69540.76,
      totalPriceWithVat: 84144.32,
      marginAmount: 0,
      order: 1,
      description: null,
      measurements: [],
    },
  ];

  const categoryA: ProjectBudgetCategory = {
    id: "demo-budget-cat-1",
    sheetId: "demo-budget-sheet-1",
    code: "0",
    name: "Všeobecné konstrukce a práce",
    order: 0,
    totalPrice: items[0].totalPrice,
    totalPriceWithVat: items[0].totalPriceWithVat,
    items: [items[0]],
  };
  const categoryBItems = items.slice(1);
  const categoryB: ProjectBudgetCategory = {
    id: "demo-budget-cat-2",
    sheetId: "demo-budget-sheet-1",
    code: "1",
    name: "Zemní práce",
    order: 1,
    totalPrice: categoryBItems.reduce((sum, item) => sum + item.totalPrice, 0),
    totalPriceWithVat: categoryBItems.reduce((sum, item) => sum + item.totalPriceWithVat, 0),
    items: categoryBItems,
  };
  const categories = [categoryA, categoryB];
  const totalPrice = categories.reduce((sum, category) => sum + category.totalPrice, 0);
  const totalPriceWithVat = categories.reduce((sum, category) => sum + category.totalPriceWithVat, 0);

  return {
    id: "demo-project-budget",
    projectId,
    name: `Rozpočet - ${project.title}`,
    status: "draft",
    currency: "CZK",
    totalPrice,
    totalPriceWithVat,
    sheets: [
      {
        id: "demo-budget-sheet-1",
        budgetId: "demo-project-budget",
        name: "SO 000",
        order: 0,
        totalPrice,
        totalPriceWithVat,
        categories,
      },
      {
        id: "demo-budget-sheet-2",
        budgetId: "demo-project-budget",
        name: "SO 110.A",
        order: 1,
        totalPrice: 0,
        totalPriceWithVat: 0,
        categories: [],
      },
    ],
  };
};

export const ProjectBudgetTab: React.FC<ProjectBudgetTabProps> = ({ projectId, project }) => {
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isTenderMenuOpen, setIsTenderMenuOpen] = useState(false);
  const [openItemTenderMenuId, setOpenItemTenderMenuId] = useState<string | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isDeleteBudgetOpen, setIsDeleteBudgetOpen] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isParsingImportPreview, setIsParsingImportPreview] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [expandedMeasurementItemIds, setExpandedMeasurementItemIds] = useState<Set<string>>(() => new Set());
  const [hiddenMeasurementItemIds, setHiddenMeasurementItemIds] = useState<Set<string>>(() => new Set());
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(() => new Set());
  const [tenderFilterId, setTenderFilterId] = useState("all");
  const [budgetViewKey, setBudgetViewKey] = useState<BudgetViewKey>("default");
  const [localTenderAssignments, setLocalTenderAssignments] = useState<Record<string, string | null>>({});
  const [tenderPlans, setTenderPlans] = useState<TenderPlanItem[]>([]);
  const [sheetContextMenu, setSheetContextMenu] = useState<SheetContextMenuState | null>(null);
  const [budgetContextMenu, setBudgetContextMenu] = useState<BudgetContextMenuState | null>(null);
  const [form, setForm] = useState<ItemFormState>(initialForm);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ParsedBudgetImport | null>(null);
  const [importColumnOverrides, setImportColumnOverrides] = useState<BudgetImportColumnOverrides>({});
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const tenderMenuRef = useRef<HTMLDivElement>(null);
  const itemTenderMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importParseRequestIdRef = useRef(0);

  const budgetQuery = useProjectBudgetQuery(projectId, project.title);
  const createItem = useCreateBudgetItemMutation(projectId);
  const createSheet = useCreateBudgetSheetMutation(projectId);
  const createCategory = useCreateBudgetCategoryMutation(projectId);
  const importBudgetItems = useImportBudgetItemsMutation(projectId);
  const updateItemTender = useUpdateBudgetItemTenderMutation(projectId);
  const deleteItem = useDeleteBudgetItemMutation(projectId);
  const deleteSheet = useDeleteBudgetSheetMutation(projectId);
  const deleteProjectBudget = useDeleteProjectBudgetMutation(projectId);
  const tenderOptions = useMemo(
    () => buildBudgetTenderOptions(project.categories || [], tenderPlans),
    [project.categories, tenderPlans],
  );
  const tenderOptionById = useMemo(
    () => new Map(tenderOptions.map((option) => [option.id, option])),
    [tenderOptions],
  );

  const isDemoBudget = projectId.startsWith("demo-");
  const demoBudget = useMemo(() => createDemoBudget(projectId, project), [projectId, project]);
  const rawBudget = budgetQuery.data ?? (isDemoBudget ? demoBudget : undefined);
  const budget = useMemo(() => {
    if (!rawBudget) return undefined;
    if (Object.keys(localTenderAssignments).length === 0) return rawBudget;

    return {
      ...rawBudget,
      sheets: rawBudget.sheets.map((sheet) => ({
        ...sheet,
        categories: sheet.categories.map((category) => ({
          ...category,
          items: category.items.map((item) =>
            Object.prototype.hasOwnProperty.call(localTenderAssignments, item.id)
              ? { ...item, demandCategoryId: localTenderAssignments[item.id] }
              : item,
          ),
        })),
      })),
    };
  }, [localTenderAssignments, rawBudget]);
  const summary = useMemo(() => (budget ? summarizeBudget(budget) : null), [budget]);
  const tenderSummaries = useMemo(() => (budget ? summarizeBudgetByTender(budget) : []), [budget]);
  const tenderSummaryById = useMemo(
    () => new Map(tenderSummaries.map((item) => [item.demandCategoryId, item])),
    [tenderSummaries],
  );
  const allItems = useMemo(() => (budget ? flattenBudgetItems(budget) : []), [budget]);
  const activeSheet = useMemo(() => {
    if (!budget) return null;
    return budget.sheets.find((sheet) => sheet.id === activeSheetId) ?? budget.sheets[0] ?? null;
  }, [activeSheetId, budget]);
  const activeDisplayCategories = useMemo(
    () => (activeSheet ? filterDisplayBudgetCategories(activeSheet.categories) : []),
    [activeSheet],
  );
  const activeBudgetView = useMemo(() => getBudgetView(budgetViewKey), [budgetViewKey]);
  const visibleColumns = activeBudgetView.columns;
  const visibleColumnCount = visibleColumns.length;
  const hasColumn = (column: BudgetColumnKey) => visibleColumns.includes(column);
  const selectedCategory = useMemo(() => {
    return activeDisplayCategories.find((category) => category.id === selectedCategoryId)
      ?? activeDisplayCategories[0]
      ?? null;
  }, [activeDisplayCategories, selectedCategoryId]);
  const focusedItem = useMemo(
    () => allItems.find((item) => item.id === focusedItemId) ?? null,
    [allItems, focusedItemId],
  );
  const displayedCategories = useMemo(() => {
    if (!activeSheet) return [];
    return filterDisplayBudgetCategories(activeSheet.categories)
      .map((category) => {
        const items = category.items.filter((item) => (
          tenderFilterId === "all"
          || (tenderFilterId === "unassigned" ? !item.demandCategoryId : item.demandCategoryId === tenderFilterId)
        ));
        return {
          ...category,
          items,
          totalPrice: items.reduce((sum, item) => sum + item.totalPrice, 0),
          totalPriceWithVat: items.reduce((sum, item) => sum + item.totalPriceWithVat, 0),
        };
      })
      .filter((category) => tenderFilterId === "all" || category.items.length > 0);
  }, [activeSheet, tenderFilterId]);
  const displayedItems = useMemo(
    () => displayedCategories.flatMap((category) => category.items),
    [displayedCategories],
  );
  const displayedTotalPrice = displayedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const displayedTotalPriceWithVat = displayedItems.reduce((sum, item) => sum + item.totalPriceWithVat, 0);
  const dph21 = displayedItems.filter((item) => item.vatRate === 21).reduce((sum, item) => sum + vatAmountFor(item), 0);
  const dph12 = displayedItems.filter((item) => item.vatRate === 12).reduce((sum, item) => sum + vatAmountFor(item), 0);
  const visibleTenderSummaries = useMemo(
    () =>
      tenderOptions
        .map((option) => ({
          option,
          category: option.category,
          summary: tenderSummaryById.get(option.id),
        }))
        .filter((entry) => (entry.summary?.itemCount ?? 0) > 0),
    [tenderOptions, tenderSummaryById],
  );
  const selectedTenderForExport = useMemo(() => {
    if (tenderFilterId === "all" || tenderFilterId === "unassigned") return null;
    const tender = tenderOptionById.get(tenderFilterId)?.category ?? null;
    const tenderSummary = tender ? tenderSummaryById.get(tender.id) : null;
    if (!tender || !tenderSummary || tenderSummary.itemCount === 0) return null;
    return tender;
  }, [tenderFilterId, tenderOptionById, tenderSummaryById]);
  const tenderFilterLabel = useMemo(() => {
    if (tenderFilterId === "all") return "Výběrová řízení · Vše";
    if (tenderFilterId === "unassigned") return "Bez řízení";
    return getTenderTitle(tenderOptions, tenderFilterId);
  }, [tenderFilterId, tenderOptions]);
  const measurementItemIds = useMemo(
    () => displayedItems.filter((item) => item.measurements.length > 0).map((item) => item.id),
    [displayedItems],
  );
  const allDisplayedCategoriesCollapsed = displayedCategories.length > 0
    && displayedCategories.every((category) => collapsedCategoryIds.has(category.id));

  const contextMenuPosition = (event: React.MouseEvent, width = 240, height = 180) => ({
    x: Math.min(event.clientX, Math.max(8, window.innerWidth - width)),
    y: Math.min(event.clientY, Math.max(8, window.innerHeight - height)),
  });

  useEffect(() => {
    let isActive = true;

    getTenderPlans(projectId)
      .then((items) => {
        if (isActive) setTenderPlans(items);
      })
      .catch(() => {
        if (isActive) setTenderPlans([]);
      });

    return () => {
      isActive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (
      !isInsertOpen
      && !isViewMenuOpen
      && !isTenderMenuOpen
      && !openItemTenderMenuId
      && !sheetContextMenu
      && !budgetContextMenu
    ) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (insertMenuRef.current && !insertMenuRef.current.contains(target)) {
        setIsInsertOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(target)) {
        setIsViewMenuOpen(false);
      }
      if (tenderMenuRef.current && !tenderMenuRef.current.contains(target)) {
        setIsTenderMenuOpen(false);
      }
      if (itemTenderMenuRef.current && !itemTenderMenuRef.current.contains(target)) {
        setOpenItemTenderMenuId(null);
      }
      setSheetContextMenu(null);
      setBudgetContextMenu(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [budgetContextMenu, isInsertOpen, isTenderMenuOpen, isViewMenuOpen, openItemTenderMenuId, sheetContextMenu]);

  useEffect(() => {
    if (!budget) return;
    const firstSheet = budget.sheets[0] ?? null;
    if (!activeSheetId || !budget.sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(firstSheet?.id ?? null);
    }
  }, [activeSheetId, budget]);

  useEffect(() => {
    if (!activeSheet) return;
    if (!selectedCategoryId || !activeDisplayCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(activeDisplayCategories[0]?.id ?? null);
    }
  }, [activeDisplayCategories, activeSheet, selectedCategoryId]);

  const updateForm = (updates: Partial<ItemFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleAddSheet = async () => {
    if (!budget) return;
    const name = window.prompt("Název objektu / listu", `SO ${budget.sheets.length + 1}`);
    if (name === null) return;
    await createSheet.mutateAsync({ budgetId: budget.id, name });
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (!budget || deleteSheet.isPending) return;
    const sheet = budget.sheets.find((item) => item.id === sheetId);
    if (!sheet) return;
    if (budget.sheets.length <= 1) {
      setMessage({ text: "Poslední list rozpočtu nelze smazat.", tone: "error" });
      return;
    }
    const confirmed = window.confirm(`Smazat list „${sheet.name}“ včetně všech kapitol, položek a výkazů výměr?`);
    if (!confirmed) return;

    const sheetIndex = budget.sheets.findIndex((item) => item.id === sheetId);
    const nextSheet = budget.sheets[sheetIndex + 1] ?? budget.sheets[sheetIndex - 1] ?? null;
    setSheetContextMenu(null);
    setMessage({ text: `Mažu list ${sheet.name}...`, tone: "info" });

    try {
      await deleteSheet.mutateAsync({ budgetId: budget.id, sheetId });
      if (activeSheet?.id === sheetId) {
        setActiveSheetId(nextSheet?.id ?? null);
        setSelectedCategoryId(nextSheet ? filterDisplayBudgetCategories(nextSheet.categories)[0]?.id ?? null : null);
        setFocusedItemId(null);
      }
      setMessage({ text: `List ${sheet.name} byl smazán.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "List se nepodařilo smazat.",
        tone: "error",
      });
    }
  };

  const handleAddCategory = async () => {
    if (!activeSheet) return;
    const name = window.prompt("Název kapitoly", "Nová kapitola");
    if (name === null) return;
    await createCategory.mutateAsync({ sheetId: activeSheet.id, name });
    setIsInsertOpen(false);
  };

  const handleOpenAddItem = () => {
    if (!selectedCategory) {
      setMessage({ text: "Nejprve vytvořte kapitolu, do které se položka vloží.", tone: "error" });
      setIsInsertOpen(false);
      return;
    }
    setIsAddItemOpen(true);
    setIsInsertOpen(false);
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!budget || !activeSheet || !selectedCategory) {
      setMessage({ text: "Nejprve vytvořte kapitolu, do které se položka vloží.", tone: "error" });
      return;
    }

    const name = form.name.trim();
    if (!name) {
      setMessage({ text: "Zadejte název položky.", tone: "error" });
      return;
    }

    try {
      await createItem.mutateAsync({
        budgetId: budget.id,
        sheetId: activeSheet.id,
        categoryId: selectedCategory.id,
        demandCategoryId: form.demandCategoryId || null,
        code: form.code,
        name,
        unit: form.unit,
        amount: parseBudgetNumber(form.amount) ?? 0,
        unitPrice: parseBudgetNumber(form.unitPrice) ?? 0,
        vatRate: form.vatRate,
        marginPercent: parseBudgetNumber(form.marginPercent) ?? 0,
        description: form.description,
      });
      setForm(initialForm);
      setIsAddItemOpen(false);
      setMessage({ text: "Položka byla přidána do rozpočtu.", tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Položku se nepodařilo uložit.",
        tone: "error",
      });
    }
  };

  const handleExportTender = async (tender: DemandCategory) => {
    if (!budget) return;
    setMessage({ text: "Připravuji export rozpočtu VŘ...", tone: "info" });
    try {
      const result = await exportBudgetTenderToXlsx({
        budget,
        project,
        tender,
        preferDesktopFolder: true,
      });
      setMessage({
        text:
          result.mode === "desktop"
            ? `Export uložen: ${result.path}`
            : `Export stažen: ${result.filename}`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Export se nepodařilo vytvořit.",
        tone: "error",
      });
    }
  };

  const handleExportBudget = async () => {
    if (!budget) return;
    setMessage({ text: "Připravuji export rozpočtu...", tone: "info" });
    try {
      const result = await exportBudgetToXlsx({
        budget,
        project,
        preferDesktopFolder: true,
      });
      setMessage({
        text:
          result.mode === "desktop"
            ? `Export uložen: ${result.path}`
            : `Export stažen: ${result.filename}`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Export rozpočtu se nepodařilo vytvořit.",
        tone: "error",
      });
    }
  };

  const closeImportPreview = () => {
    if (isParsingImportPreview || importBudgetItems.isPending) return;
    setIsImportPreviewOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportColumnOverrides({});
    setImportPreviewError(null);
  };

  const parseImportPreview = async (
    file: File,
    columnOverrides: BudgetImportColumnOverrides,
  ) => {
    const requestId = importParseRequestIdRef.current + 1;
    importParseRequestIdRef.current = requestId;
    setIsParsingImportPreview(true);
    setImportPreviewError(null);
    try {
      const parsed = await parseBudgetImportFile(file, { columnOverrides });
      if (requestId !== importParseRequestIdRef.current) return;
      setImportPreview(parsed);
      if (parsed.rows.length === 0) {
        setImportPreviewError("Soubor neobsahuje rozpoznatelné rozpočtové položky. Zkontrolujte mapování sloupců.");
      }
    } catch (error) {
      if (requestId !== importParseRequestIdRef.current) return;
      setImportPreview(null);
      setImportPreviewError(error instanceof Error ? error.message : "Import XLS se nepodařilo zpracovat.");
    } finally {
      if (requestId === importParseRequestIdRef.current) {
        setIsParsingImportPreview(false);
      }
    }
  };

  const handleImportBudgetFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !budget) return;

    const initialOverrides: BudgetImportColumnOverrides = {};
    setImportFile(file);
    setImportPreview(null);
    setImportColumnOverrides(initialOverrides);
    setImportPreviewError(null);
    setIsImportPreviewOpen(true);
    setMessage({ text: `Čtu import ${file.name}...`, tone: "info" });
    await parseImportPreview(file, initialOverrides);
  };

  const handleRemapImportColumn = (field: BudgetImportColumnField, value: number) => {
    if (!importFile) return;
    const next: BudgetImportColumnOverrides = { ...importColumnOverrides, [field]: value };
    setImportColumnOverrides(next);
    void parseImportPreview(importFile, next);
  };

  const handleResetImportMapping = () => {
    if (!importFile) return;
    const next: BudgetImportColumnOverrides = {};
    setImportColumnOverrides(next);
    void parseImportPreview(importFile, next);
  };

  const handleConfirmBudgetImport = async () => {
    if (!budget || !importPreview || importPreview.rows.length === 0) return;

    setMessage({ text: `Importuji ${importPreview.rows.length.toLocaleString("cs-CZ")} položek...`, tone: "info" });
    try {
      const result = await importBudgetItems.mutateAsync({
        budgetId: budget.id,
        items: importPreview.rows,
      });
      setMessage({
        text: formatBudgetImportReport(importPreview, result),
        tone: "success",
      });
      setIsImportPreviewOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setImportColumnOverrides({});
      setImportPreviewError(null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Import XLS se nepodařilo uložit.";
      setImportPreviewError(text);
      setMessage({ text, tone: "error" });
    }
  };

  const handleDeleteProjectBudget = async () => {
    if (!budget || isDemoBudget || deleteProjectBudget.isPending) return;

    setMessage({ text: "Mažu rozpočet stavby...", tone: "info" });
    try {
      await deleteProjectBudget.mutateAsync(budget.id);
      setActiveSheetId(null);
      setSelectedCategoryId(null);
      setFocusedItemId(null);
      setLocalTenderAssignments({});
      setExpandedMeasurementItemIds(new Set());
      setHiddenMeasurementItemIds(new Set());
      setIsAddItemOpen(false);
      setMessage({ text: "Rozpočet byl smazán. Byl založen nový prázdný rozpočet stavby.", tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Rozpočet se nepodařilo smazat.",
        tone: "error",
      });
    } finally {
      setIsDeleteBudgetOpen(false);
    }
  };

  const handleAssignItemTender = (item: ProjectBudgetItem, demandCategoryId: string | null) => {
    const previousDemandCategoryId = item.demandCategoryId ?? null;

    setLocalTenderAssignments((prev) => ({
      ...prev,
      [item.id]: demandCategoryId,
    }));
    setOpenItemTenderMenuId(null);

    if (isDemoBudget) return;

    updateItemTender.mutate(
      {
        itemId: item.id,
        demandCategoryId,
      },
      {
        onError: (error) => {
          setLocalTenderAssignments((prev) => ({
            ...prev,
            [item.id]: previousDemandCategoryId,
          }));
          setMessage({
            text: error instanceof Error ? error.message : "Přiřazení VŘ se nepodařilo uložit.",
            tone: "error",
          });
        },
      },
    );
  };

  const toggleItemMeasurements = (itemId: string) => {
    if (showMeasurements) {
      setHiddenMeasurementItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      return;
    }

    setExpandedMeasurementItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleCategoryCollapsed = (categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const applyCategoryCollapseAction = () => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (allDisplayedCategoriesCollapsed) {
        displayedCategories.forEach((category) => next.delete(category.id));
      } else {
        displayedCategories.forEach((category) => next.add(category.id));
      }
      return next;
    });
    setBudgetContextMenu(null);
  };

  const showAllMeasurements = () => {
    setShowMeasurements(true);
    setExpandedMeasurementItemIds(new Set());
    setHiddenMeasurementItemIds(new Set());
    setBudgetContextMenu(null);
  };

  const hideAllMeasurements = () => {
    setShowMeasurements(false);
    setExpandedMeasurementItemIds(new Set());
    setHiddenMeasurementItemIds(new Set());
    setBudgetContextMenu(null);
  };

  const renderCategory = (category: ProjectBudgetCategory, categoryIndex: number) => {
    const isCategoryCollapsed = collapsedCategoryIds.has(category.id);
    return (
      <React.Fragment key={category.id}>
        <tr className="bg-[var(--tf-skin-surface-muted)] text-[var(--tf-skin-text)]">
          {hasColumn("select") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 text-center">
              <input type="checkbox" className="size-3.5 border-[var(--tf-skin-line-2)] accent-[var(--tf-skin-orange)]" aria-label={`Vybrat kapitolu ${category.name}`} />
            </td>
          )}
          {hasColumn("position") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 text-sm font-black">{categoryIndex + 1}</td>
          )}
          {hasColumn("code") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 font-mono text-[10px] text-[var(--tf-skin-muted)]">{category.code ?? ""}</td>
          )}
          {hasColumn("description") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 text-[11px] font-black">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  toggleCategoryCollapsed(category.id);
                }}
                className="mr-2 inline-flex size-4 items-center justify-center border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] text-[var(--tf-skin-muted)] hover:border-[var(--tf-skin-orange)] hover:text-[var(--tf-skin-orange-deep)]"
                title={isCategoryCollapsed ? "Rozbalit položky kapitoly" : "Sbalit kapitolu"}
                aria-expanded={!isCategoryCollapsed}
              >
                <ChevronDown className={`size-2.5 transition ${isCategoryCollapsed ? "-rotate-90" : ""}`} />
              </button>
              {category.name}
            </td>
          )}
          {hasColumn("tender") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("source") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("unit") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("amount") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("unitPrice") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 text-right text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
              Mezisoučet kapitoly:
            </td>
          )}
          {hasColumn("total") && (
            <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1 text-right text-[12px] font-black">
              {formatBudgetCurrency(category.totalPrice)}
            </td>
          )}
          {hasColumn("vat") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("margin") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
          {hasColumn("actions") && <td className="border-b border-[var(--tf-skin-line-2)] px-2 py-1" />}
        </tr>
        {!isCategoryCollapsed && category.items.map((item, itemIndex) => {
          const isFocused = item.id === focusedItemId;
          const isMeasurementExpanded = showMeasurements
            ? !hiddenMeasurementItemIds.has(item.id)
            : expandedMeasurementItemIds.has(item.id);
          return (
            <React.Fragment key={item.id}>
              <tr
                onClick={() => setFocusedItemId(item.id)}
                className={`group border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] text-[10px] hover:bg-[color-mix(in_srgb,var(--tf-skin-orange)_7%,var(--tf-skin-card)_93%)] ${
                  isFocused ? "bg-[color-mix(in_srgb,var(--tf-skin-orange)_10%,var(--tf-skin-card)_90%)]" : ""
                }`}
              >
                {hasColumn("select") && (
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" className="size-3.5 border-[var(--tf-skin-line-2)] accent-[var(--tf-skin-orange)]" aria-label={`Vybrat položku ${item.name}`} />
                  </td>
                )}
                {hasColumn("position") && (
                  <td className="px-2 py-1 font-mono text-[var(--tf-skin-muted-2)]">
                    {item.positionLabel || `${categoryIndex + 1}.${itemIndex + 1}`}
                  </td>
                )}
                {hasColumn("code") && (
                  <td className="px-2 py-1 font-mono font-bold text-[var(--tf-skin-muted)]">{item.code || "-"}</td>
                )}
                {hasColumn("description") && (
                  <td className="min-w-[320px] px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleItemMeasurements(item.id);
                        }}
                        disabled={item.measurements.length === 0}
                        className={`inline-flex h-4 items-center border px-1 text-[8px] font-black transition ${
                          isMeasurementExpanded
                            ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100"
                        } disabled:cursor-not-allowed disabled:border-[var(--tf-skin-line)] disabled:bg-[var(--tf-skin-surface-muted)] disabled:text-[var(--tf-skin-muted-2)]`}
                        title={
                          item.measurements.length > 0
                            ? isMeasurementExpanded
                              ? "Skrýt výkaz výměr položky"
                              : "Zobrazit výkaz výměr položky"
                            : "Položka nemá výkaz výměr"
                        }
                        aria-pressed={isMeasurementExpanded}
                      >
                        VV
                      </button>
                      <span className="font-bold uppercase tracking-[0.02em] text-[var(--tf-skin-text)]">{item.name}</span>
                    </div>
                    {item.description && (
                      <p className="line-clamp-1 text-[9px] text-[var(--tf-skin-muted)]">{item.description}</p>
                    )}
                  </td>
                )}
                {hasColumn("tender") && (
                  <td className="px-2 py-1">
                    <div
                      className="relative"
                      ref={openItemTenderMenuId === item.id ? itemTenderMenuRef : undefined}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenItemTenderMenuId((prev) => (prev === item.id ? null : item.id))}
                        className="flex h-6 w-40 items-center justify-between gap-1 border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-1.5 text-left text-[9px] font-bold text-[var(--tf-skin-text-2)] outline-none hover:border-[var(--tf-skin-orange)]"
                        title={getTenderTitle(tenderOptions, item.demandCategoryId)}
                      >
                        <span className="truncate">{getTenderTitle(tenderOptions, item.demandCategoryId)}</span>
                        <ChevronDown className={`size-3 shrink-0 text-[var(--tf-skin-muted)] transition ${openItemTenderMenuId === item.id ? "rotate-180" : ""}`} />
                      </button>
                      {openItemTenderMenuId === item.id && (
                        <div className={`${menuPanelClass} left-0 w-56 py-1`}>
                          {[
                            { id: "", title: "Bez řízení" },
                            ...tenderOptions.map((option) => ({
                              id: option.id,
                              title: option.title,
                            })),
                          ].map((option) => {
                            const optionValue = option.id || null;
                            const isSelected = (item.demandCategoryId ?? null) === optionValue;

                            return (
                              <button
                                key={option.id || "unassigned"}
                                type="button"
                                onClick={() => handleAssignItemTender(item, optionValue)}
                                className={menuButtonClass}
                              >
                                <span className="truncate">{option.title}</span>
                                {isSelected && <Check className="size-3.5 shrink-0 text-[var(--tf-skin-orange)]" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                )}
                {hasColumn("source") && (
                  <td className="px-2 py-1 text-center">
                    <span className="inline-flex h-4 items-center border border-[color-mix(in_srgb,var(--tf-skin-blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--tf-skin-blue)_10%,var(--tf-skin-card)_90%)] px-1 text-[8px] font-black text-[var(--tf-skin-blue)]">
                      AI
                    </span>
                  </td>
                )}
                {hasColumn("unit") && <td className="px-2 py-1 text-center font-black uppercase">{item.unit}</td>}
                {hasColumn("amount") && (
                  <td className="px-2 py-1 text-right font-mono font-black text-[var(--tf-skin-green)]">
                    {item.amount.toLocaleString("cs-CZ")}
                  </td>
                )}
                {hasColumn("unitPrice") && <td className="px-2 py-1 text-right font-mono font-black">{formatBudgetCurrency(item.unitPrice)}</td>}
                {hasColumn("total") && <td className="px-2 py-1 text-right font-mono font-black">{formatBudgetCurrency(item.totalPrice)}</td>}
                {hasColumn("vat") && <td className="px-2 py-1 text-center font-mono">{item.vatRate}</td>}
                {hasColumn("margin") && <td className="px-2 py-1 text-center font-mono">{item.marginPercent.toLocaleString("cs-CZ")}</td>}
                {hasColumn("actions") && (
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteItem.mutate(item.id);
                      }}
                      className="inline-flex size-6 items-center justify-center text-[var(--tf-skin-muted-2)] hover:bg-red-50 hover:text-red-600"
                      title="Smazat položku"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                )}
              </tr>
              {isMeasurementExpanded && item.measurements.length > 0 && (
                <tr className="bg-[color-mix(in_srgb,var(--tf-skin-green)_10%,var(--tf-skin-card)_90%)]">
                  <td colSpan={visibleColumnCount} className="border-b border-[color-mix(in_srgb,var(--tf-skin-green)_25%,var(--tf-skin-line)_75%)] px-6 py-2">
                    <div className="grid grid-cols-[1fr_1fr_100px] gap-2 text-[9px]">
                      <div className="font-black uppercase tracking-[0.12em] text-[var(--tf-skin-green)]">Výkaz výměr</div>
                      <div className="text-[var(--tf-skin-muted)]">Vzorec</div>
                      <div className="text-right font-black text-[var(--tf-skin-green)]">Celkem</div>
                      {item.measurements.map((measurement) => (
                        <React.Fragment key={measurement.id}>
                          <div className="whitespace-pre-wrap font-bold text-[var(--tf-skin-text)]">{measurement.note}</div>
                          <div className="whitespace-pre-wrap font-mono text-[var(--tf-skin-muted)]">{measurement.formula}</div>
                          <div className="text-right font-mono font-black">{measurement.result.toLocaleString("cs-CZ")}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  };

  if (budgetQuery.isLoading && !isDemoBudget) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--tf-skin-bg)] text-[var(--tf-skin-muted)]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Načítám rozpočet...
      </div>
    );
  }

  if ((budgetQuery.error && !isDemoBudget) || !budget || !summary) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--tf-skin-bg)] p-6 text-sm text-red-600">
        Rozpočet se nepodařilo načíst.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--tf-skin-bg)] text-[var(--tf-skin-text)]">
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-3 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center text-[var(--tf-skin-muted)] hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-text)]"
                  title="Zpět"
                >
                  <ChevronDown className="size-4 rotate-90" />
                </button>
                <div className="min-w-0">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--tf-skin-muted)]">
                    Aktivní stavební uzel
                  </div>
                  <h2 className="truncate text-base font-black text-[var(--tf-skin-text)]">{project.title}</h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className={toolbarButtonClass} title="Rozpočet je v této verzi editovatelný">
                  <Unlock className="size-3.5" />
                  Odemčeno
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMeasurements((prev) => {
                      const next = !prev;
                      if (next) {
                        setHiddenMeasurementItemIds(new Set());
                      } else {
                        setExpandedMeasurementItemIds(new Set());
                        setHiddenMeasurementItemIds(new Set());
                      }
                      return next;
                    });
                  }}
                  className={toolbarButtonClass}
                >
                  <FileSpreadsheet className="size-3.5" />
                  {showMeasurements ? "Skrýt VV" : "Zobrazit VV"}
                </button>
                <div className="relative" ref={insertMenuRef}>
                  <button type="button" onClick={() => setIsInsertOpen((prev) => !prev)} className={darkToolbarButtonClass}>
                    <FolderPlus className="size-3.5" />
                    Vložit
                    <ChevronDown className="size-3" />
                  </button>
                  {isInsertOpen && (
                    <div className={`${menuPanelClass} right-0 w-64 py-1`}>
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-text-2)] hover:bg-[color-mix(in_srgb,var(--tf-skin-orange)_8%,var(--tf-skin-card)_92%)]"
                      >
                        <FolderPlus className="size-3.5" />
                        Vytvořit oddíl
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenAddItem}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-text-2)] hover:bg-[color-mix(in_srgb,var(--tf-skin-orange)_8%,var(--tf-skin-card)_92%)]"
                      >
                        <FilePlus2 className="size-3.5" />
                        Vytvořit položku
                      </button>
                    </div>
                  )}
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.xlsm,.xlsb,.ods"
                  onChange={handleImportBudgetFile}
                />
                <button
                  type="button"
                  className={toolbarButtonClass}
                  onClick={() => importInputRef.current?.click()}
                  disabled={importBudgetItems.isPending || isParsingImportPreview}
                  title="Importovat XLS/XLSX rozpočet"
                >
                  {importBudgetItems.isPending || isParsingImportPreview ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                  Importovat XLS
                </button>
                <button
                  type="button"
                  className={toolbarButtonClass}
                  onClick={() => void handleExportBudget()}
                  title="Exportovat celý rozpočet"
                >
                  <Download className="size-3.5" />
                  Export rozpočtu
                </button>
                <button
                  type="button"
                  className={toolbarButtonClass}
                  onClick={() => {
                    if (selectedTenderForExport) void handleExportTender(selectedTenderForExport);
                  }}
                  disabled={!selectedTenderForExport}
                  title={
                    selectedTenderForExport
                      ? "Exportovat položky vybraného VŘ"
                      : "Vyberte filtr konkrétního VŘ s položkami"
                  }
                >
                  <Download className="size-3.5" />
                  Export VŘ
                </button>
                <button
                  type="button"
                  className={toolbarButtonClass}
                  onClick={() => setIsDeleteBudgetOpen(true)}
                  disabled={isDemoBudget || deleteProjectBudget.isPending}
                  title={isDemoBudget ? "Demo rozpočet nelze smazat" : "Smazat celý rozpočet stavby"}
                >
                  {deleteProjectBudget.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Smazat
                </button>
              </div>
            </div>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--tf-skin-muted)]">Pohled</span>
              <div className="relative" ref={viewMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsViewMenuOpen((prev) => !prev)}
                  className="flex h-7 min-w-44 items-center justify-between gap-2 border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-2.5 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[var(--tf-skin-text-2)] hover:border-[var(--tf-skin-orange)]"
                  aria-expanded={isViewMenuOpen}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Eye className="size-3.5 shrink-0 text-[var(--tf-skin-muted)]" />
                    <span className="truncate">{activeBudgetView.label}</span>
                  </span>
                  <ChevronDown className={`size-3 shrink-0 transition ${isViewMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {isViewMenuOpen && (
                  <div className={`${menuPanelClass} left-0 w-72 py-1`}>
                    {BUDGET_VIEW_PRESETS.map((view) => (
                      <button
                        key={view.key}
                        type="button"
                        onClick={() => {
                          setBudgetViewKey(view.key);
                          setIsViewMenuOpen(false);
                        }}
                        className={menuButtonClass}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{view.label}</span>
                          <span className="block truncate text-[8px] font-bold normal-case tracking-normal text-[var(--tf-skin-muted)]">
                            {view.hint} · {view.columns.length} sloupců
                          </span>
                        </span>
                        {view.key === budgetViewKey ? <Check className="size-3.5 shrink-0 text-[var(--tf-skin-orange)]" /> : <Columns3 className="size-3.5 shrink-0 text-[var(--tf-skin-muted)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCcw className="size-3.5 text-[var(--tf-skin-muted-2)]" />
              <div className="relative" ref={tenderMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsTenderMenuOpen((prev) => !prev)}
                  className="flex h-7 w-60 items-center justify-between gap-2 border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-2.5 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[var(--tf-skin-text-2)] hover:border-[var(--tf-skin-orange)]"
                  aria-expanded={isTenderMenuOpen}
                  title={tenderFilterLabel}
                >
                  <span className="truncate">{tenderFilterLabel}</span>
                  <ChevronDown className={`size-3 shrink-0 transition ${isTenderMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {isTenderMenuOpen && (
                  <div className={`${menuPanelClass} right-0 w-72 py-1`}>
                    {[
                      { id: "all", title: "Výběrová řízení · Vše" },
                      { id: "unassigned", title: "Bez řízení" },
                      ...tenderOptions.map((option) => ({ id: option.id, title: option.title })),
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setTenderFilterId(option.id);
                          setIsTenderMenuOpen(false);
                        }}
                        className={menuButtonClass}
                      >
                        <span className="truncate">{option.title}</span>
                        {option.id === tenderFilterId && <Check className="size-3.5 shrink-0 text-[var(--tf-skin-orange)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`border-b px-4 py-2 text-xs font-semibold ${
                message.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : message.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {isAddItemOpen && (
            <form onSubmit={handleAddItem} className="border-b border-[color-mix(in_srgb,var(--tf-skin-orange)_38%,var(--tf-skin-line)_62%)] bg-[color-mix(in_srgb,var(--tf-skin-orange)_8%,var(--tf-skin-surface)_92%)] px-3 py-2">
              <div className="grid grid-cols-[96px_1fr_62px_90px_110px_78px_160px_64px] gap-1.5">
                <input className={compactInputClass} value={form.code} onChange={(event) => updateForm({ code: event.target.value })} placeholder="Kód" />
                <input className={compactInputClass} value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Popis a technologická specifikace stavebního prvku" />
                <input className={compactInputClass} value={form.unit} onChange={(event) => updateForm({ unit: event.target.value })} placeholder="MJ" />
                <input className={compactInputClass} inputMode="decimal" value={form.amount} onChange={(event) => updateForm({ amount: event.target.value })} placeholder="Množství" />
                <input className={compactInputClass} inputMode="decimal" value={form.unitPrice} onChange={(event) => updateForm({ unitPrice: event.target.value })} placeholder="Jedn. cena" />
                <select className={compactInputClass} value={form.vatRate} onChange={(event) => updateForm({ vatRate: Number(event.target.value) as ProjectBudgetVatRate })}>
                  <option value={21}>21 %</option>
                  <option value={12}>12 %</option>
                  <option value={0}>0 %</option>
                </select>
                <select className={compactInputClass} value={form.demandCategoryId} onChange={(event) => updateForm({ demandCategoryId: event.target.value })}>
                  <option value="">Bez řízení</option>
                  {tenderOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.title}</option>
                  ))}
                </select>
                <button type="submit" disabled={createItem.isPending} className={darkToolbarButtonClass}>
                  {createItem.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Vložit
                </button>
              </div>
              <div className="mt-1.5 text-[9px] font-semibold text-[var(--tf-skin-muted)]">
                Položka bude vložena do kapitoly: <span className="font-black text-[var(--tf-skin-text)]">{selectedCategory?.name ?? "bez kapitoly"}</span>
              </div>
            </form>
          )}

          <div
            className="min-h-0 flex-1 overflow-auto bg-[var(--tf-skin-card)] px-2 pb-2"
            onContextMenu={(event) => {
              event.preventDefault();
              setSheetContextMenu(null);
              setBudgetContextMenu(contextMenuPosition(event, 260, 190));
            }}
          >
            <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {hasColumn("select") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.select}`} />}
                  {hasColumn("position") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.position}`}>P.č.</th>}
                  {hasColumn("code") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.code}`}>Kód položky</th>}
                  {hasColumn("description") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.description}`}>Popis a technologická specifikace stavebního prvku</th>}
                  {hasColumn("tender") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.tender}`}>Řízení</th>}
                  {hasColumn("source") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.source}`}>Zdroj</th>}
                  {hasColumn("unit") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.unit}`}>MJ</th>}
                  {hasColumn("amount") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.amount}`}>Množství VV</th>}
                  {hasColumn("unitPrice") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.unitPrice}`}>Jednotková cena</th>}
                  {hasColumn("total") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.total}`}>Celkem bez DPH</th>}
                  {hasColumn("vat") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.vat}`}>DPH %</th>}
                  {hasColumn("margin") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.margin}`}>Marže %</th>}
                  {hasColumn("actions") && <th className={`${headerCellClass} ${COLUMN_WIDTHS.actions}`}>Akce</th>}
                </tr>
              </thead>
              <tbody>
                {displayedCategories.map((category, index) => renderCategory(category, index))}
                {displayedCategories.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumnCount} className="px-3 py-16 text-center text-sm text-[var(--tf-skin-muted)]">
                      {activeDisplayCategories.length === 0
                        ? "List zatím nemá kapitoly."
                        : "Aktuální filtr neobsahuje žádné položky."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] xl:flex">
          <div className="border-b border-[var(--tf-skin-line)] p-3">
            <h3 className="border-b border-[var(--tf-skin-line)] pb-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--tf-skin-text)]">
              Závěrečná rekapitulace
            </h3>
            <div className="mt-3 space-y-1.5 text-[10px] font-mono text-[var(--tf-skin-muted)]">
              <div className="flex justify-between">
                <span>Základní DPH (21 %)</span>
                <span>{formatBudgetCurrency(dph21)}</span>
              </div>
              <div className="flex justify-between">
                <span>Snížená DPH (12 %)</span>
                <span>{formatBudgetCurrency(dph12)}</span>
              </div>
              <div className="flex justify-between pt-2 text-[11px] font-black text-[var(--tf-skin-text-2)]">
                <span>Celkem DPH</span>
                <span>{formatBudgetCurrency(displayedTotalPriceWithVat - displayedTotalPrice)}</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-end justify-between border border-[color-mix(in_srgb,var(--tf-skin-orange)_35%,transparent)] bg-[var(--tf-skin-surface-deep)] px-3 py-2 text-[var(--tf-skin-text)]">
              <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-orange)]">Celkem bez DPH</span>
              <span className="font-mono text-base font-black">{formatBudgetCurrency(displayedTotalPrice)}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <h4 className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
              Rekapitulace podle objektů
            </h4>
            <div className="space-y-3">
              <div className="border-b border-[var(--tf-skin-line)] pb-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-[var(--tf-skin-text)]">{activeSheet?.name ?? "Aktivní list"}</p>
                      <p className="text-[8px] font-black uppercase text-[var(--tf-skin-muted)]">{displayedItems.length} položek</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] font-black text-[var(--tf-skin-text)]">{formatBudgetCurrency(displayedTotalPrice)}</p>
                      <p className="font-mono text-[8px] text-[var(--tf-skin-muted)]">bez DPH</p>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {displayedCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between gap-2 text-[9px] text-[var(--tf-skin-muted)]">
                        <span className="truncate">{category.name}</span>
                        <span className="shrink-0 font-mono font-black text-[var(--tf-skin-text-2)]">{formatBudgetCurrency(category.totalPrice)}</span>
                      </div>
                    ))}
                    {displayedCategories.length === 0 && (
                      <p className="text-[10px] text-[var(--tf-skin-muted)]">Žádné položky v aktuálním zobrazení.</p>
                    )}
                  </div>
              </div>
            </div>

            <h4 className="mb-2 mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
              Výběrová řízení
            </h4>
            <div className="space-y-1.5">
              {visibleTenderSummaries.map(({ option, category, summary: tenderSummary }) => {
                return (
                  <div key={category.id} className="border-b border-[var(--tf-skin-line)] pb-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black text-[var(--tf-skin-text)]">{option.title}</p>
                        <p className="text-[8px] font-black uppercase text-[var(--tf-skin-muted)]">{tenderSummary?.itemCount ?? 0} položek</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportTender(category)}
                        disabled={!tenderSummary || tenderSummary.itemCount === 0}
                        className="inline-flex size-6 items-center justify-center border border-[var(--tf-skin-line)] text-[var(--tf-skin-muted)] hover:border-[var(--tf-skin-orange)] hover:text-[var(--tf-skin-orange)] disabled:opacity-30"
                        title="Exportovat položky VŘ"
                      >
                        <Download className="size-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-right font-mono text-[10px] font-black">
                      {formatBudgetCurrency(tenderSummary?.totalPrice ?? 0)}
                    </p>
                  </div>
                );
              })}
              {visibleTenderSummaries.length === 0 && (
                <div className="border border-dashed border-[var(--tf-skin-line-2)] p-3 text-[11px] text-[var(--tf-skin-muted)]">
                  Žádné položky zatím nejsou přiřazené k výběrovému řízení.
                </div>
              )}
            </div>

            <h4 className="mb-2 mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tf-skin-muted)]">
              Aktivní prvek
            </h4>
            {focusedItem ? (
              <div className="space-y-2 text-[11px]">
                <span className="inline-flex border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-card)] px-1.5 py-0.5 font-mono text-[9px] font-black text-[var(--tf-skin-text)]">
                  {focusedItem.code || "bez kódu"}
                </span>
                <p className="text-[12px] font-black leading-snug text-[var(--tf-skin-text)]">{focusedItem.name}</p>
                <p className="text-[10px] text-[var(--tf-skin-muted)]">Řízení: {getTenderTitle(tenderOptions, focusedItem.demandCategoryId)}</p>
                {focusedItem.description && (
                  <div className="border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] p-2 text-[10px] leading-normal text-[var(--tf-skin-text-2)]">
                    {focusedItem.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-[10px] text-[var(--tf-skin-muted)]">
                Klepněte na řádek tabulky pro detail položky.
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="flex h-11 shrink-0 items-stretch border-t border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-surface)]">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {budget.sheets.map((sheet) => {
            const isActive = sheet.id === activeSheet?.id;
            return (
              <button
                key={sheet.id}
                type="button"
                onClick={() => setActiveSheetId(sheet.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setActiveSheetId(sheet.id);
                  setBudgetContextMenu(null);
                  setSheetContextMenu({
                    sheetId: sheet.id,
                    sheetName: sheet.name,
                    ...contextMenuPosition(event, 220, 110),
                  });
                }}
                className={`min-w-[120px] max-w-[190px] border-r border-[var(--tf-skin-line)] px-3 text-left text-[10px] font-black uppercase tracking-[0.08em] transition ${
                  isActive
                    ? "border-t-4 border-t-[var(--tf-skin-orange)] bg-[var(--tf-skin-card)] text-[var(--tf-skin-text)]"
                    : "text-[var(--tf-skin-muted)] hover:bg-[var(--tf-skin-card)] hover:text-[var(--tf-skin-text)]"
                }`}
              >
                <span className="block truncate">{sheet.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleAddSheet}
            className="flex min-w-11 items-center justify-center border-r border-[var(--tf-skin-line)] text-[var(--tf-skin-muted)] hover:bg-[var(--tf-skin-card)] hover:text-[var(--tf-skin-orange)]"
            title="Přidat objekt / list"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="flex min-w-[220px] shrink-0 flex-col items-end justify-center border-l border-[var(--tf-skin-line-2)] px-3 text-right">
          <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--tf-skin-muted)]">Celkem bez DPH</span>
          <strong className="font-mono text-[13px] font-black text-[var(--tf-skin-text)]">{formatBudgetCurrency(displayedTotalPrice)}</strong>
        </div>
      </footer>

      {budgetContextMenu && (
        <div
          className={`${contextMenuClass} w-64 py-1`}
          style={{ left: budgetContextMenu.x, top: budgetContextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--tf-skin-muted)]">Rozpočet</div>
            <div className="truncate text-[10px] font-black text-[var(--tf-skin-text)]">{activeSheet?.name ?? "Aktivní list"}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={applyCategoryCollapseAction}
            disabled={displayedCategories.length === 0}
            className={`${menuButtonClass} disabled:cursor-not-allowed disabled:text-[var(--tf-skin-muted-2)] disabled:hover:bg-transparent`}
          >
            <span>{allDisplayedCategoriesCollapsed ? "Rozbalit položky" : "Sbalit kapitoly"}</span>
            {allDisplayedCategoriesCollapsed ? <ChevronsDown className="size-3.5" /> : <ChevronsUp className="size-3.5" />}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={showAllMeasurements}
            disabled={measurementItemIds.length === 0}
            className={`${menuButtonClass} disabled:cursor-not-allowed disabled:text-[var(--tf-skin-muted-2)] disabled:hover:bg-transparent`}
          >
            <span>Zobrazit VV všech položek</span>
            <FileSpreadsheet className="size-3.5" />
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={hideAllMeasurements}
            disabled={measurementItemIds.length === 0}
            className={`${menuButtonClass} disabled:cursor-not-allowed disabled:text-[var(--tf-skin-muted-2)] disabled:hover:bg-transparent`}
          >
            <span>Skrýt VV všech položek</span>
            <FileSpreadsheet className="size-3.5" />
          </button>
        </div>
      )}

      {sheetContextMenu && (
        <div
          className={`${contextMenuClass} w-56 py-1`}
          style={{ left: sheetContextMenu.x, top: sheetContextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-3 py-2">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--tf-skin-muted)]">List</div>
            <div className="truncate text-[10px] font-black text-[var(--tf-skin-text)]">{sheetContextMenu.sheetName}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleDeleteSheet(sheetContextMenu.sheetId)}
            disabled={isDemoBudget || budget.sheets.length <= 1 || deleteSheet.isPending}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.08em] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-[var(--tf-skin-muted-2)] disabled:hover:bg-transparent"
          >
            <span>Smazat list</span>
            {deleteSheet.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteBudgetOpen}
        title="Smazat rozpočet?"
        message={`Smažete celý rozpočet stavby „${project.title}“ včetně objektů, kapitol, položek, přiřazení k VŘ a výkazů výměr. Tato akce nejde vrátit zpět.`}
        confirmLabel={deleteProjectBudget.isPending ? "Mažu..." : "Smazat rozpočet"}
        cancelLabel="Zrušit"
        onConfirm={() => void handleDeleteProjectBudget()}
        onCancel={() => setIsDeleteBudgetOpen(false)}
        variant="danger"
      />
      <ProjectBudgetImportModal
        isOpen={isImportPreviewOpen}
        preview={importPreview}
        columnOverrides={importColumnOverrides}
        isParsing={isParsingImportPreview}
        isImporting={importBudgetItems.isPending}
        error={importPreviewError}
        onRemapColumn={handleRemapImportColumn}
        onResetMapping={handleResetImportMapping}
        onConfirm={() => void handleConfirmBudgetImport()}
        onCancel={closeImportPreview}
      />
    </div>
  );
};
