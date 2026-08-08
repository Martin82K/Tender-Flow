import type { OrganizationMember } from "@features/organization/api";

export interface ContractOverviewPermissionState {
  checked: boolean;
  source: "automatic" | "explicit";
  canAssignExplicitly: boolean;
}

export const resolveContractOverviewPermissionState = (
  member: Pick<OrganizationMember, "role" | "is_active">,
  explicitEnabled: boolean,
  actorCanManage: boolean,
): ContractOverviewPermissionState => {
  const automatic = member.role === "owner" || member.role === "admin";
  return {
    checked: automatic || explicitEnabled,
    source: automatic ? "automatic" : "explicit",
    canAssignExplicitly: actorCanManage && member.role === "member" && member.is_active !== false,
  };
};
