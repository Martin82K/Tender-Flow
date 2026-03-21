export type RequiredProjectAccess = "read" | "edit";

export type ProjectAccessCheck =
  | null
  | {
      rpcName: "is_project_shared_with_user" | "has_project_share_permission";
      rpcArgs: Record<string, string>;
      deniedMessage: string;
    };

export const getProjectAccessCheck = (args: {
  ownerId: string | null;
  userId: string;
  isDemo: boolean;
  projectId: string;
  requiredAccess?: RequiredProjectAccess;
}): ProjectAccessCheck => {
  if (args.ownerId && args.ownerId === args.userId) {
    return null;
  }

  if (args.isDemo) {
    return null;
  }

  if (args.requiredAccess === "edit") {
    return {
      rpcName: "has_project_share_permission",
      rpcArgs: {
        p_id: args.projectId,
        u_id: args.userId,
        required_permission: "edit",
      },
      deniedMessage: "Projekt neni sdilen pro editaci tomuto uzivateli.",
    };
  }

  return {
    rpcName: "is_project_shared_with_user",
    rpcArgs: {
      p_id: args.projectId,
      u_id: args.userId,
    },
    deniedMessage: "Projekt neni sdilen pro tohoto uzivatele.",
  };
};
