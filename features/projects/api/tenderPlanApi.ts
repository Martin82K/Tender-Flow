import { tenderPlanRepository } from "@/infra/projects/tenderPlanRepository";
import type { DemandCategory, TenderPlanItem } from "@/types";

const normalizeName = (value: string) => value.trim().toLowerCase();

export const createTenderPlanId = () => `tp_${Date.now()}`;
export const createTenderPlanRandomId = () =>
  `tp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const getTenderPlans = async (projectId: string): Promise<TenderPlanItem[]> => {
  return tenderPlanRepository.listByProject(projectId);
};

export const createTenderPlan = async (input: {
  id: string;
  projectId: string;
  name: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null;
}) => {
  return tenderPlanRepository.create(input);
};

export const updateTenderPlanItem = async (input: {
  id: string;
  name?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null;
}) => {
  return tenderPlanRepository.update(input);
};

export const updateTenderPlanDates = async (
  id: string,
  dateFrom: string | null,
  dateTo: string | null,
) => {
  return tenderPlanRepository.update({ id, dateFrom, dateTo });
};

export const linkTenderPlanToCategory = async (id: string, categoryId: string) => {
  return tenderPlanRepository.update({ id, categoryId });
};

export const deleteTenderPlan = async (id: string) => {
  return tenderPlanRepository.remove(id);
};

export const syncTenderPlansWithCategories = async (input: {
  projectId: string;
  categories: DemandCategory[];
  currentItems: TenderPlanItem[];
}) => {
  let createdCount = 0;
  let linkedCount = 0;

  for (const category of input.categories) {
    const existingItem = input.currentItems.find(
      (item) =>
        item.name.toLowerCase() === category.title.toLowerCase() ||
        (item.categoryId && item.categoryId === category.id),
    );

    if (!existingItem) {
      await createTenderPlan({
        id: createTenderPlanRandomId(),
        projectId: input.projectId,
        name: category.title,
        dateFrom: category.realizationStart || null,
        dateTo: category.realizationEnd || null,
        categoryId: category.id,
      });
      createdCount++;
      continue;
    }

    if (!existingItem.categoryId) {
      await linkTenderPlanToCategory(existingItem.id, category.id);
      linkedCount++;
    }
  }

  return { createdCount, linkedCount };
};

export const groupTenderPlansByName = (items: TenderPlanItem[]) => {
  const grouped = new Map<string, TenderPlanItem[]>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
};
