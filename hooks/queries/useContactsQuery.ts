import { useAuth } from "@/context/AuthContext";
import {
  useContactsQuery as useFeatureContactsQuery,
} from "@features/contacts/hooks/useContactsQuery";

export { CONTACT_KEYS } from "@features/contacts/hooks/useContactsQuery";

export const useContactsQuery = () => {
  const { user } = useAuth();

  return useFeatureContactsQuery({
    userId: user?.id,
    userRole: user?.role,
  });
};
