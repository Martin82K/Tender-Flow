export const PROJECT_DETAILS_KEYS = {
  all: ["projectDetails"] as const,
  detail: (projectId: string) => ["projectDetails", projectId] as const,
};
