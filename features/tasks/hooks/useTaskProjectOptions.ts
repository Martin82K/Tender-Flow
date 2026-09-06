import { useProjectsState } from "@features/projects/model/useProjectsState";

// Keep the existing construction-project dependency at one task feature boundary.
export const useTaskProjectOptions = () => useProjectsState().projects;
