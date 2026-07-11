import { useAuth } from "@/context/AuthContext";
import {
  useProjectsQuery as useFeatureProjectsQuery,
} from "@features/projects/hooks/useProjectsQuery";

export { PROJECT_KEYS } from "@features/projects/hooks/useProjectsQuery";

export const useProjectsQuery = () => {
  const { user } = useAuth();
  return useFeatureProjectsQuery({ user });
};
