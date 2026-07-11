import type { ActiveProjectStatus, Project, ProjectStatus } from "@/types";

export interface ProjectVisibilityRow {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus | null;
  archived_original_status: ActiveProjectStatus | null;
  is_demo: boolean;
  owner_id: string | null;
}

export interface ProjectVisibilityMetadataRow {
  project_id: string;
  owner_email: string;
  shared_with_emails: readonly string[] | null;
}

export interface ProjectVisibilityIdentity {
  userId?: string | null;
  userEmail?: string | null;
}

interface ProjectMetadata {
  owner: string;
  shared: readonly string[];
}

const normalizeEmail = (email: string | null | undefined): string =>
  String(email || "").trim().toLowerCase();

export const mapVisibleProjects = (
  projectRows: readonly ProjectVisibilityRow[],
  metadataRows: readonly ProjectVisibilityMetadataRow[],
  identity: ProjectVisibilityIdentity,
): Project[] => {
  const metadataByProjectId = new Map<string, ProjectMetadata>();
  metadataRows.forEach((metadata) => {
    metadataByProjectId.set(metadata.project_id, {
      owner: metadata.owner_email,
      shared: metadata.shared_with_emails || [],
    });
  });

  const currentUserId = String(identity.userId || "").trim();
  const currentUserEmail = normalizeEmail(identity.userEmail);

  return projectRows
    .filter((project) => {
      if (project.is_demo === true) return true;
      if (currentUserId && project.owner_id === currentUserId) return true;
      if (!currentUserEmail) return false;

      const metadata = metadataByProjectId.get(project.id);
      return Boolean(
        metadata?.shared.some(
          (email) => normalizeEmail(email) === currentUserEmail,
        ),
      );
    })
    .map((project) => {
      const metadata = metadataByProjectId.get(project.id);
      return {
        id: project.id,
        name: project.name,
        location: project.location || "",
        status: project.status || "realization",
        archivedOriginalStatus: project.archived_original_status ?? null,
        isDemo: project.is_demo,
        // Zachovává dosavadní runtime kontrakt databázového řádku (null u demo dat).
        ownerId: project.owner_id as Project["ownerId"],
        ownerEmail: metadata?.owner,
        sharedWith: metadata ? [...metadata.shared] : undefined,
      };
    });
};
