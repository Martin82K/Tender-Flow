import type { BudgetAttachment, DemandCategory } from "@/types";

type BudgetAttachmentRegistry = Record<string, Record<string, BudgetAttachment>>;

const STORAGE_KEY = "tender-flow:budget-attachments:v1";

const canUseLocalStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isBudgetAttachment = (value: unknown): value is BudgetAttachment => {
  if (!isPlainRecord(value)) return false;

  return (
    value.source === "dochub" &&
    typeof value.fileName === "string" &&
    value.fileName.trim().length > 0 &&
    typeof value.relativePath === "string" &&
    value.relativePath.trim().length > 0 &&
    typeof value.selectedAt === "string" &&
    value.selectedAt.trim().length > 0 &&
    value.enabled === true &&
    (typeof value.size === "undefined" || typeof value.size === "number")
  );
};

const normalizeRegistry = (value: unknown): BudgetAttachmentRegistry => {
  if (!isPlainRecord(value)) return {};

  return Object.entries(value).reduce<BudgetAttachmentRegistry>(
    (registry, [projectId, projectValue]) => {
      if (!isPlainRecord(projectValue)) return registry;

      const categoryRegistry = Object.entries(projectValue).reduce<
        Record<string, BudgetAttachment>
      >((categories, [categoryId, attachment]) => {
        if (isBudgetAttachment(attachment)) {
          categories[categoryId] = attachment;
        }
        return categories;
      }, {});

      if (Object.keys(categoryRegistry).length > 0) {
        registry[projectId] = categoryRegistry;
      }

      return registry;
    },
    {},
  );
};

const readRegistry = (): BudgetAttachmentRegistry => {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return normalizeRegistry(JSON.parse(raw));
  } catch {
    return {};
  }
};

const writeRegistry = (registry: BudgetAttachmentRegistry): void => {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
};

export const getLocalBudgetAttachment = (
  projectId: string | undefined,
  categoryId: string | undefined,
): BudgetAttachment | null => {
  if (!projectId || !categoryId) return null;
  return readRegistry()[projectId]?.[categoryId] || null;
};

export const saveLocalBudgetAttachment = (
  projectId: string,
  categoryId: string,
  attachment: BudgetAttachment | null | undefined,
): void => {
  const registry = readRegistry();
  const projectRegistry = { ...(registry[projectId] || {}) };

  if (attachment?.enabled) {
    projectRegistry[categoryId] = attachment;
  } else {
    delete projectRegistry[categoryId];
  }

  if (Object.keys(projectRegistry).length > 0) {
    registry[projectId] = projectRegistry;
  } else {
    delete registry[projectId];
  }

  writeRegistry(registry);
};

export const applyLocalBudgetAttachments = (
  projectId: string,
  categories: DemandCategory[],
): DemandCategory[] => {
  const projectRegistry = readRegistry()[projectId] || {};
  return categories.map((category) => ({
    ...category,
    budgetAttachment: projectRegistry[category.id] || undefined,
  }));
};
