import { supabase } from "./supabase";
import { ActiveProjectStatus, Project, ProjectTeamRole } from "../types";
import { isDemoSession, DEMO_PROJECT } from "./demoData";

export const projectService = {
  // Fetch projects (will only return owned or shared due to RLS)
  getProjects: async (): Promise<Project[]> => {
    // If in demo session, return demo project only
    if (isDemoSession()) {
      return [DEMO_PROJECT];
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location || "",
      status: p.status || "realization",
      archivedOriginalStatus: (p.archived_original_status as ActiveProjectStatus | null) ?? null,
      ownerId: p.owner_id, // Need to add to type if not exists
      organizationId: p.organization_id || undefined,
      isDemo: p.is_demo,
    }));
  },

  createProject: async (project: Project): Promise<void> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase.from("projects").insert({
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      owner_id: user.id,
    });

    if (error) throw error;
  },

  createProjectWithTeam: async (project: Project): Promise<void> => {
    if (!project.organizationId) throw new Error("Pro vytvoření stavby je nutná aktivní organizace.");
    const { error } = await supabase.rpc("create_project_with_team", {
      project_id_input: project.id,
      name_input: project.name,
      location_input: project.location,
      status_input: project.status,
      organization_id_input: project.organizationId,
      team_input: (project.initialTeam || []).map((member) => ({
        user_id: member.userId,
        role: member.role,
      })),
    });
    if (error) throw new Error(error.message);
  },

  getMyProjectAccess: async (): Promise<Record<string, ProjectTeamRole | "owner_admin">> => {
    const { data, error } = await supabase.rpc("get_my_project_access");
    if (error) throw new Error(error.message);
    return Object.fromEntries(
      ((data || []) as Array<{ project_id: string; project_role: ProjectTeamRole | "owner_admin" }>)
        .map((row) => [row.project_id, row.project_role]),
    );
  },

  getProjectTeam: async (projectId: string): Promise<Array<{
    userId: string;
    email: string;
    displayName: string;
    role: ProjectTeamRole | "owner_admin";
    legacyExternal: boolean;
  }>> => {
    const { data, error } = await supabase.rpc("get_project_team", { project_id_input: projectId });
    if (error) throw new Error(error.message);
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      userId: String(row.user_id),
      email: String(row.email || ""),
      displayName: String(row.display_name || row.email || ""),
      role: row.role as ProjectTeamRole | "owner_admin",
      legacyExternal: row.legacy_external === true,
    }));
  },

  setProjectTeamMember: async (projectId: string, userId: string, role: ProjectTeamRole): Promise<void> => {
    const { error } = await supabase.rpc("set_project_team_member", {
      project_id_input: projectId,
      user_id_input: userId,
      role_input: role,
    });
    if (error) throw new Error(error.message);
  },

  removeProjectTeamMember: async (projectId: string, userId: string): Promise<void> => {
    const { error } = await supabase.rpc("remove_project_team_member", {
      project_id_input: projectId,
      user_id_input: userId,
    });
    if (error) throw new Error(error.message);
  },

  setProjectArchived: async (projectId: string, archived: boolean): Promise<void> => {
    const { error } = await supabase.rpc("set_project_archived", {
      project_id_input: projectId,
      archived_input: archived,
    });
    if (error) throw new Error(error.message);
  },

  updateProject: async (
    id: string,
    updates: Partial<Project>
  ): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.location) dbUpdates.location = updates.location;
    if (updates.status) dbUpdates.status = updates.status;

    const { error } = await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw error;
  },

  deleteProject: async (id: string, isDemo: boolean = false): Promise<void> => {
    if (isDemo) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_hidden_projects").insert({
          user_id: user.id,
          project_id: id,
        });
      }
    } else {
      const { error } = await supabase.from("projects").delete().eq("id", id);

      if (error) throw error;
    }
  },

  // Sharing Methods
  shareProject: async (
    projectId: string,
    email: string,
    permission: "view" | "edit" = "edit"
  ): Promise<void> => {
    // Find user by email using RPC
    const { data: userData, error: userError } = await supabase.rpc(
      "get_user_id_by_email",
      { email_input: email }
    );

    if (userError || !userData)
      throw new Error("Uživatel s tímto emailem nebyl nalezen.");

    const userId = userData;

    const { error } = await supabase.from("project_shares").insert({
      project_id: projectId,
      user_id: userId,
      permission: permission,
    });

    if (error) {
      if (error.code === "23505")
        throw new Error("Tento uživatel již má přístup k projektu.");
      throw error;
    }
  },

  updateSharePermission: async (
    projectId: string,
    userId: string,
    permission: "view" | "edit"
  ): Promise<void> => {
    const { error } = await supabase
      .from("project_shares")
      .update({ permission })
      .match({ project_id: projectId, user_id: userId });

    if (error) throw error;
  },

  getProjectShares: async (projectId: string) => {
    // We need to join with profiles or something to get emails.
    // But auth.users is not joinable directly easily.
    // Maybe we store email in `project_shares`? No, normalization.
    // Use RPC to fetch shares with emails?

    const { data, error } = await supabase.rpc("get_project_shares_debug", {
      project_id_input: projectId,
    });

    if (error) throw error;
    return data as { user_id: string; email: string; permission: string }[];
  },

  removeShare: async (projectId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("project_shares")
      .delete()
      .match({ project_id: projectId, user_id: userId });

    if (error) throw error;
  },

  transferProjectOwnership: async (
    projectId: string,
    newOwnerUserId: string,
  ): Promise<void> => {
    const { error } = await supabase.rpc("transfer_project_ownership", {
      project_id_input: projectId,
      new_owner_user_id: newOwnerUserId,
    });
    if (error) throw new Error(error.message);
  },
};
