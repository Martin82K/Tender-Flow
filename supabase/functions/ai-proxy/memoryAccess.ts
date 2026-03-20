export interface ProjectAccessRow {
  id: string;
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
    select(columns: "id, organization_id"): {
      eq(column: "id", value: string): ProjectAccessLookup;
    };
  };
}

export interface AuthorizedProjectMemoryContext {
  organizationId: string;
  projectId: string;
}

export const resolveAuthorizedProjectMemoryContext = async (
  client: ProjectAccessClient,
  projectId: string,
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
    .select("id, organization_id")
    .eq("id", normalizedProjectId)
    .maybeSingle();

  if (error || !project?.id) {
    return { ok: false, error: "PROJECT_ACCESS_DENIED" };
  }

  const organizationId = String(project.organization_id || "").trim();
  if (!organizationId) {
    return { ok: false, error: "PROJECT_ORGANIZATION_MISSING" };
  }

  return {
    ok: true,
    value: {
      organizationId,
      projectId: normalizedProjectId,
    },
  };
};
