import { dbAdapter } from "@/services/dbAdapter";

export interface CloneTenderToRealizationResult {
  projectId: string;
}

const buildCloneProjectErrorMessage = (error: unknown): string => {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  const normalized = `${code} ${message}`.toLowerCase();
  const missingRpc =
    normalized.includes("clone_tender_project_to_realization") &&
    (
      normalized.includes("schema cache") ||
      normalized.includes("could not find the function") ||
      normalized.includes("404")
    );

  if (missingRpc) {
    return "V databázi chybí nová RPC funkce pro přepnutí soutěže do realizace. Je potřeba aplikovat migraci `20260319120000_clone_tender_to_realization.sql` a obnovit schema cache Supabase.";
  }

  if (message.trim().length > 0) {
    return message;
  }

  return "Nepodařilo se vytvořit realizační kopii projektu.";
};

export const cloneTenderToRealization = async (
  projectId: string,
): Promise<CloneTenderToRealizationResult> => {
  const { data, error } = await dbAdapter.rpcRest<
    Array<{ project_id?: string; cloned_project_id?: string }> | { project_id?: string; cloned_project_id?: string }
  >("clone_tender_project_to_realization", {
    project_id_input: projectId,
  });

  if (error) {
    throw new Error(buildCloneProjectErrorMessage(error));
  }

  const row = Array.isArray(data) ? data[0] : data;
  const clonedProjectId = (row?.cloned_project_id || row?.project_id || "").trim();

  if (!clonedProjectId) {
    throw new Error("Server nevrátil ID nově vytvořeného projektu.");
  }

  return { projectId: clonedProjectId };
};
