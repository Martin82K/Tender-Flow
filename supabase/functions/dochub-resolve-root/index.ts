import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import { getGoogleFolderMeta, parseGoogleFolderId, resolveMicrosoftSharingUrl } from "../_shared/dochub_providers.ts";

type Provider = "gdrive" | "onedrive";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const provider = (body?.provider as Provider) || null;
    const projectId = (body?.projectId as string) || null;
    const url = (body?.url as string) || null;
    const rootId = (body?.rootId as string) || null;

    if (!provider || !["gdrive", "onedrive"].includes(provider)) return json(400, { error: "Invalid provider" });
    if (!projectId) return json(400, { error: "Missing projectId" });
    if (provider === "gdrive") {
      if (!url && !rootId) return json(400, { error: "Missing url/rootId" });
    } else {
      if (!url) return json(400, { error: "Missing url" });
    }

    // Verify user can access project via RLS
    const { data: projectRow, error: projectError } = await authed
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !projectRow) return json(403, { error: "No access to project" });

    const { accessToken } = await getAccessTokenForUser({
      userId: userData.user.id,
      provider,
    });

    const service = createServiceClient();

    if (provider === "gdrive") {
      const folderId = rootId || parseGoogleFolderId(url || "");
      if (!folderId) return json(400, { error: "Could not parse Google Drive folder ID from URL" });

      const meta = await getGoogleFolderMeta({ accessToken, folderId });

      await service
        .from("projects")
        .update({
          dochub_enabled: true,
          dochub_provider: "gdrive",
          dochub_root_id: meta.id,
          dochub_root_name: meta.name,
          dochub_root_web_url: meta.webViewLink,
          dochub_root_link: meta.webViewLink,
          dochub_drive_id: meta.driveId || null,
          dochub_status: "connected",
          dochub_last_error: null,
        })
        .eq("id", projectId);

      return json(200, {
        rootId: meta.id,
        rootName: meta.name,
        rootWebUrl: meta.webViewLink,
        driveId: meta.driveId || null,
      });
    }

    const resolved = await resolveMicrosoftSharingUrl({ accessToken, sharingUrl: url });

    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "onedrive",
        dochub_root_id: resolved.id,
        dochub_root_name: resolved.name,
        dochub_root_web_url: resolved.webUrl,
        dochub_root_link: resolved.webUrl,
        dochub_drive_id: resolved.driveId,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", projectId);

    return json(200, {
      rootId: resolved.id,
      rootName: resolved.name,
      rootWebUrl: resolved.webUrl,
      driveId: resolved.driveId,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
