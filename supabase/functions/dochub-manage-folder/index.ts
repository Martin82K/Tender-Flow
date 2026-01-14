import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import {
    findOrCreateGoogleFolder,
    findOrCreateMicrosoftFolder,
    type Provider,
} from "../_shared/dochub_providers.ts";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

/*
  Google Drive Rename Helper
*/
const renameGoogleFolder = async (args: { accessToken: string; fileId: string; newName: string }) => {
    const url = `https://www.googleapis.com/drive/v3/files/${args.fileId}`;
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            authorization: `Bearer ${args.accessToken}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({ name: args.newName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || "Google Drive rename failed");
    }
    return { id: data.id, name: data.name };
};

/*
  Google Drive Delete Helper (Trash)
*/
const deleteGoogleFolder = async (args: { accessToken: string; fileId: string }) => {
    // We accept fileId but usually we want to trash it, not permanently delete.
    // Permanent delete uses DELETE method. Trashing uses PATCH with trashed=true.
    const url = `https://www.googleapis.com/drive/v3/files/${args.fileId}`;

    // Try sending to trash first
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            authorization: `Bearer ${args.accessToken}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || "Google Drive delete failed");
    }
    return { success: true };
};

/*
  OneDrive Rename Helper
*/
const renameMicrosoftFolder = async (args: { accessToken: string; itemId: string; newName: string; driveId?: string }) => {
    const drivePath = args.driveId ? `/drives/${args.driveId}` : '/me/drive';
    const url = `https://graph.microsoft.com/v1.0${drivePath}/items/${args.itemId}`;

    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            authorization: `Bearer ${args.accessToken}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({ name: args.newName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || "OneDrive rename failed");
    }
    return { id: data.id, name: data.name };
};

/*
  OneDrive Delete Helper
*/
const deleteMicrosoftFolder = async (args: { accessToken: string; itemId: string; driveId?: string }) => {
    const drivePath = args.driveId ? `/drives/${args.driveId}` : '/me/drive';
    const url = `https://graph.microsoft.com/v1.0${drivePath}/items/${args.itemId}`;

    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            authorization: `Bearer ${args.accessToken}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "OneDrive delete failed");
    }
    return { success: true };
};


Deno.serve(async (req) => {
    const cors = handleCors(req);
    if (cors) return cors;

    try {
        const rawBody = await req.json().catch(() => null);
        const action = (rawBody?.action as "create" | "rename" | "delete") || null;
        const projectId = (rawBody?.projectId as string) || null;
        const provider = (rawBody?.provider as Provider) || null;

        // Common args
        const name = (rawBody?.name as string) || "";
        const parentId = (rawBody?.parentId as string) || null; // for create
        const folderId = (rawBody?.folderId as string) || null; // for rename/delete (the provider's ID)
        const newName = (rawBody?.newName as string) || ""; // for rename

        if (!projectId || !provider || !action) {
            return json(400, { error: "Missing required fields (projectId, provider, action)" });
        }

        const authed = createAuthedUserClient(req);
        const { data: userData, error: userError } = await authed.auth.getUser();
        if (userError || !userData.user) return json(401, { error: "Unauthorized" });

        // Verify access
        const { data: project, error: projectError } = await authed
            .from("projects")
            .select("dochub_root_id, dochub_drive_id")
            .eq("id", projectId)
            .maybeSingle();

        if (projectError || !project) return json(403, { error: "No access to project" });

        const { accessToken } = await getAccessTokenForUser({
            userId: userData.user.id,
            provider,
        });

        const rootId = project.dochub_root_id;
        const driveId = project.dochub_drive_id;

        if (action === "create") {
            if (!name) return json(400, { error: "Missing name for create" });
            const targetParentId = parentId || rootId;
            if (!targetParentId) return json(400, { error: "Missing parentId and no rootId found" });

            if (provider === "gdrive") {
                const folder = await findOrCreateGoogleFolder({
                    accessToken,
                    parentId: targetParentId,
                    name,
                    appProperties: { dochubProjectId: projectId }
                });
                return json(200, { success: true, id: folder.id, webUrl: folder.webViewLink, created: folder.created });
            } else {
                if (!driveId) return json(400, { error: "Missing driveId for OneDrive" });
                const folder = await findOrCreateMicrosoftFolder({
                    accessToken,
                    parentId: targetParentId,
                    name,
                    driveId
                });
                return json(200, { success: true, id: folder.id, webUrl: folder.webUrl, created: folder.created });
            }
        }

        if (action === "rename") {
            if (!folderId || !newName) return json(400, { error: "Missing folderId or newName for rename" });

            if (provider === "gdrive") {
                await renameGoogleFolder({ accessToken, fileId: folderId, newName });
            } else {
                await renameMicrosoftFolder({ accessToken, itemId: folderId, newName, driveId: driveId || undefined });
            }
            return json(200, { success: true });
        }

        if (action === "delete") {
            if (!folderId) return json(400, { error: "Missing folderId for delete" });

            if (provider === "gdrive") {
                await deleteGoogleFolder({ accessToken, fileId: folderId });
            } else {
                await deleteMicrosoftFolder({ accessToken, itemId: folderId, driveId: driveId || undefined });
            }
            return json(200, { success: true });
        }

        return json(400, { error: "Invalid action" });

    } catch (e) {
        return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
    }
});
