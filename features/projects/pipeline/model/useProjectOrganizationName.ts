import { useQuery } from "@tanstack/react-query";

import { organizationService } from "@features/organization";

interface UseProjectOrganizationNameInput {
  projectOrganizationId?: string | null;
  activeOrganizationId?: string | null;
  activeOrganizationName?: string | null;
  currentUserId?: string | null;
}

const PROJECT_ORGANIZATIONS_KEY = "project-export-organizations";

export const useProjectOrganizationName = ({
  projectOrganizationId,
  activeOrganizationId,
  activeOrganizationName,
  currentUserId,
}: UseProjectOrganizationNameInput): string => {
  const isActiveOrganization = Boolean(
    projectOrganizationId && projectOrganizationId === activeOrganizationId,
  );
  const shouldResolveProjectOrganization = Boolean(
    currentUserId && projectOrganizationId && !isActiveOrganization,
  );
  const organizationsQuery = useQuery({
    queryKey: [PROJECT_ORGANIZATIONS_KEY, currentUserId],
    enabled: shouldResolveProjectOrganization,
    queryFn: () => organizationService.getMyOrganizations(),
    staleTime: 5 * 60 * 1000,
  });

  if (!projectOrganizationId || isActiveOrganization) {
    return activeOrganizationName?.trim() || "Organizace";
  }

  return organizationsQuery.data?.find(
    ({ organization_id }) => organization_id === projectOrganizationId,
  )?.organization_name?.trim() || "Organizace";
};
