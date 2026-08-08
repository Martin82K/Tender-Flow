import { rolePermissionsRpc } from "@infra/organization/rolePermissionsRpc";

export const rolePermissionsService = {
  list: rolePermissionsRpc.list,
  set: rolePermissionsRpc.set,
};

export type { OrganizationRolePermissionRow } from "@infra/organization/rolePermissionsRpc";
