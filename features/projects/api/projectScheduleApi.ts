import { tenderPlanRepository } from "@/infra/projects/tenderPlanRepository";

export const updateCategoryRealizationWindow = async (input: {
  categoryId: string;
  realizationStart: string | null;
  realizationEnd: string | null;
}) => {
  return tenderPlanRepository.updateCategoryRealizationWindow(input);
};

export const updateCategoryDeadline = async (
  categoryId: string,
  deadline: string | null,
) => {
  return tenderPlanRepository.updateCategoryDeadline(categoryId, deadline);
};
