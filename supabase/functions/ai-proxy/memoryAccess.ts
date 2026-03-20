export interface ProjectAccessRow {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
}

export interface ProjectAccessLookup {
  maybeSingle(): Promise<{
    data: ProjectAccessRow | null;
    error: { message?: string } | null;
  }>;
}

export interface ProjectAccessClient {
  from(table: "projects"): {
    select(columns: "id, owner_id, organization_id"): {
      eq(column: "id", value: string): ProjectAccessLookup;
    };
  };
  from(table: "project_shares"): {
    select(columns: "permission"): {
      eq(column: "project_id", value: string): {
        eq(column: "user_id", value: string): {
          in(column: "permission", values: ("view" | "edit")[]): ProjectAccessLookup;
        };
      };
    };
  };
}

export interface AuthorizedProjectMemoryContext {
  organizationId: string;
  projectId: string;
}

export type RequiredProjectPermission = "view" | "edit";

export const resolveAuthorizedProjectMemoryContext = async (
  client: ProjectAccessClient,
  projectId: string,
  userId: string,
  requiredPermission: RequiredProjectPermission,
): Promise<
  | { ok: true; value: AuthorizedProjectMemoryContext }
  | { ok: false; error: "PROJECT_ACCESS_DENIED" | "PROJECT_ORGANIZATION_MISSING" }
> => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return { ok: false, error: "PROJECT_ACCESS_DENIED" };
  }

  const { data: project, error } = await client
    .from("projects")
    .select("id, owner_id, organization_id")
    .eq("id", normalizedProjectId)
    .maybeSingle();

  if (error || !project?.id) {
    return { ok: false, error: "PROJECT_ACCESS_DENIED" };
  }

  const organizationId = String(project.organization_id || "").trim();
  if (!organizationId) {
    return { ok: false, error: "PROJECT_ORGANIZATION_MISSING" };
  }

  if (project.owner_id === userId) {
    return {
      ok: true,
      value: {
        organizationId,
        projectId: normalizedProjectId,
      },
    };
  }

  const permissions = requiredPermission === "edit" ? ["edit"] : ["view", "edit"];
  const { data: share, error: shareError } = await client
    .from("project_shares")
    .select("permission")
    .eq("project_id", normalizedProjectId)
    .eq("user_id", userId)
    .in("permission", permissions)
    .maybeSingle();

  if (shareError || !share) {
    return { ok: false, error: "PROJECT_ACCESS_DENIED" };
  }

  return {
    ok: true,
    value: {
      organizationId,
      projectId: normalizedProjectId,
    },
  };
};
