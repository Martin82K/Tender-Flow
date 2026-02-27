import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import type { Project, ProjectDetails } from "@/types";

export interface ActiveProjectContext {
  project: Project;
  details: ProjectDetails;
}

export const getActiveProjectContext = (
  runtime: AgentRuntimeSnapshot,
): ActiveProjectContext | null => {
  if (!runtime.selectedProjectId) return null;

  const project = runtime.projects.find((item) => item.id === runtime.selectedProjectId);
  const details = runtime.projectDetails[runtime.selectedProjectId];

  if (!project || !details) return null;

  return { project, details };
};

export const formatCurrency = (value: number): string =>
  `${value.toLocaleString("cs-CZ")} Kč`;

export const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const keywordScore = (message: string, keywords: string[]): number => {
  const normalizedMessage = normalizeText(message);
  let score = 0;

  for (const keyword of keywords) {
    if (normalizedMessage.includes(normalizeText(keyword))) {
      score += 0.22;
    }
  }

  return Math.min(score, 1);
};
