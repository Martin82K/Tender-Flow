import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectClientCard } from "@/types";
import { clientCardApi } from "./clientCardApi";

export const projectClientCardQueryKey = (projectId: string) => ["project-client-card", projectId] as const;

export const useProjectClientCard = (projectId?: string) =>
  useQuery({
    queryKey: projectClientCardQueryKey(projectId || "missing"),
    queryFn: () => clientCardApi.get(projectId || ""),
    enabled: Boolean(projectId),
  });

export const useSaveProjectClientCard = (projectId: string, organizationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (card: ProjectClientCard) => {
      if (!organizationId) throw new Error("Karta objednatele vyžaduje organizaci stavby.");
      return clientCardApi.save(projectId, organizationId, card);
    },
    onSuccess: (card) => {
      queryClient.setQueryData(projectClientCardQueryKey(projectId), card);
    },
  });
};

export const useRemoveProjectClientCard = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clientCardApi.remove(projectId),
    onSuccess: () => {
      queryClient.setQueryData(projectClientCardQueryKey(projectId), null);
    },
  });
};
