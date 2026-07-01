import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_DETAILS_KEYS } from "@/hooks/queries/useProjectDetailsQuery";
import { withTimeout } from "@/utils/helpers";
import { budgetRepository } from "./budgetRepository";
import type {
  ProjectBudgetImportItemInput,
  ProjectBudgetImportProgress,
  ProjectBudgetItemInput,
} from "../model/budgetTypes";

export const PROJECT_BUDGET_KEYS = {
  all: ["projectBudgets"] as const,
  detail: (projectId: string) => [...PROJECT_BUDGET_KEYS.all, projectId] as const,
  existing: (projectId: string) => [...PROJECT_BUDGET_KEYS.all, "existing", projectId] as const,
};

export const PROJECT_BUDGET_LOAD_TIMEOUT_MS = 20_000;
export const PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE = "Načtení rozpočtu vypršelo";

export const loadProjectBudget = (projectId: string, projectTitle?: string) =>
  withTimeout(
    budgetRepository.getOrCreateProjectBudget(projectId, projectTitle),
    PROJECT_BUDGET_LOAD_TIMEOUT_MS,
    PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE,
  );

export const loadExistingProjectBudget = (projectId: string) =>
  withTimeout(
    budgetRepository.getProjectBudget(projectId),
    PROJECT_BUDGET_LOAD_TIMEOUT_MS,
    PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE,
  );

export const useProjectBudgetQuery = (
  projectId: string,
  projectTitle?: string,
) =>
  useQuery({
    queryKey: PROJECT_BUDGET_KEYS.detail(projectId),
    queryFn: () => loadProjectBudget(projectId, projectTitle),
    enabled: !!projectId,
    retry: false,
    staleTime: 60 * 1000,
  });

export const useExistingProjectBudgetQuery = (projectId: string) =>
  useQuery({
    queryKey: PROJECT_BUDGET_KEYS.existing(projectId),
    queryFn: () => loadExistingProjectBudget(projectId),
    enabled: !!projectId,
    retry: false,
    staleTime: 60 * 1000,
  });

export const useCreateBudgetItemMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectBudgetItemInput) => budgetRepository.createItem(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};

export const useCreateBudgetSheetMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { budgetId: string; name: string }) => budgetRepository.createSheet(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
      ]);
    },
  });
};

export const useCreateBudgetCategoryMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string; name: string; code?: string | null }) =>
      budgetRepository.createCategory(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
      ]);
    },
  });
};

export const useImportBudgetItemsMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      budgetId: string;
      items: ProjectBudgetImportItemInput[];
      onProgress?: (progress: ProjectBudgetImportProgress) => void;
    }) =>
      budgetRepository.importItems(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};

export const useUpdateBudgetItemTenderMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; demandCategoryId: string | null }) =>
      budgetRepository.updateItemTender(input.itemId, input.demandCategoryId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};

export const useDeleteBudgetItemMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => budgetRepository.deleteItem(itemId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};

export const useDeleteBudgetSheetMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { budgetId: string; sheetId: string }) => budgetRepository.deleteSheet(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};

export const useDeleteProjectBudgetMutation = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: string) => budgetRepository.deleteProjectBudget(projectId, budgetId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_BUDGET_KEYS.existing(projectId) }),
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) }),
      ]);
    },
  });
};
