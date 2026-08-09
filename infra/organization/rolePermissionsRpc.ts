import { supabase } from "@/services/supabase";
import type { ProjectTeamRole } from "@/types";
import type { ProjectPermissionLevel } from "@shared/authorization/projectRoles";

export interface OrganizationRolePermissionRow {
  roleKey: ProjectTeamRole;
  permissionKey: string;
  accessLevel: ProjectPermissionLevel;
  canApprove: boolean;
}

export const rolePermissionsRpc = {
  async list(orgId: string): Promise<OrganizationRolePermissionRow[]> {
    const { data, error } = await supabase.rpc("get_organization_role_permissions", {
      org_id_input: orgId,
    });
    if (error) throw new Error(error.message);
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      roleKey: row.role_key as ProjectTeamRole,
      permissionKey: String(row.permission_key),
      accessLevel: row.access_level as ProjectPermissionLevel,
      canApprove: row.can_approve === true,
    }));
  },

  async set(args: {
    orgId: string;
    roleKey: ProjectTeamRole;
    permissionKey: string;
    accessLevel: ProjectPermissionLevel;
    canApprove: boolean;
  }): Promise<void> {
    const { error } = await supabase.rpc("set_organization_role_permission", {
      org_id_input: args.orgId,
      role_key_input: args.roleKey,
      permission_key_input: args.permissionKey,
      access_level_input: args.accessLevel,
      can_approve_input: args.canApprove,
    });
    if (error) throw new Error(error.message);
  },
};
