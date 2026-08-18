import type { BudgetAttachment, DemandCategory } from "@/types";
import { MAX_BUDGET_ATTACHMENT_COUNT } from "./budgetAttachmentModel";

type BudgetAttachmentRegistry = Record<string, Record<string, BudgetAttachment[]>>;

const STORAGE_KEY = "tender-flow:budget-attachments:v2";
const LEGACY_STORAGE_KEY = "tender-flow:budget-attachments:v1";

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
        Record<string, BudgetAttachment[]>
      >((categories, [categoryId, value]) => {
        const attachments = (Array.isArray(value)
          ? value.filter(isBudgetAttachment)
          : isBudgetAttachment(value)
            ? [value]
            : []).slice(0, MAX_BUDGET_ATTACHMENT_COUNT);
        if (attachments.length > 0) {
          categories[categoryId] = attachments;
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
    const raw = window.localStorage.getItem(STORAGE_KEY)
      || window.localStorage.getItem(LEGACY_STORAGE_KEY);
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
  return getLocalBudgetAttachments(projectId, categoryId)[0] || null;
};

export const getLocalBudgetAttachments = (
  projectId: string | undefined,
  categoryId: string | undefined,
): BudgetAttachment[] => {
  if (!projectId || !categoryId) return [];
  return readRegistry()[projectId]?.[categoryId] || [];
};

export const saveLocalBudgetAttachment = (
  projectId: string,
  categoryId: string,
  attachment: BudgetAttachment | null | undefined,
): void => {
  saveLocalBudgetAttachments(
    projectId,
    categoryId,
    attachment?.enabled ? [attachment] : [],
  );
};

export const saveLocalBudgetAttachments = (
  projectId: string,
  categoryId: string,
  attachments: BudgetAttachment[] | null | undefined,
): void => {
  const registry = readRegistry();
  const projectRegistry = { ...(registry[projectId] || {}) };
  const enabledAttachments = (attachments || [])
    .filter((attachment) => attachment.enabled)
    .slice(0, MAX_BUDGET_ATTACHMENT_COUNT);

  if (enabledAttachments.length > 0) {
    projectRegistry[categoryId] = enabledAttachments;
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
  return categories.map((category) => {
    const attachments = projectRegistry[category.id];
    return {
      ...category,
      budgetAttachments: attachments,
      budgetAttachment: attachments?.[0] || undefined,
    };
  });
};
