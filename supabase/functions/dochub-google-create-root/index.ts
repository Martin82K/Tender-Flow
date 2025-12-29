import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";

type Provider = "gdrive";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const createGoogleFolder = async (args: {
  accessToken: string;
  name: string;
  parentId?: string | null;
}) => {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("fields", "id,name,webViewLink,driveId");
  url.searchParams.set("supportsAllDrives", "true");

  const body: Record<string, unknown> = {
    name: args.name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (args.parentId) body.parents = [args.parentId];

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Google Drive folder creation failed");
  }
  return data as { id: string; name: string; webViewLink: string; driveId?: string };
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const projectId = (body?.projectId as string) || null;
    const name = ((body?.name as string) || "").trim();
    const parentId = (body?.parentId as string) || null;

    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!name) return json(400, { error: "Missing name" });

    // Verify user can access project via RLS
    const { data: projectRow, error: projectError } = await authed
      .from("projects")
      .select("id, dochub_mode")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !projectRow) return json(403, { error: "No access to project" });

    const { accessToken } = await getAccessTokenForUser({
      userId: userData.user.id,
      provider: "gdrive",
    });

    const folder = await createGoogleFolder({ accessToken, name, parentId });

    const service = createServiceClient();
    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "gdrive",
        dochub_root_id: folder.id,
        dochub_root_name: folder.name,
        dochub_root_web_url: folder.webViewLink,
        dochub_root_link: folder.webViewLink,
        dochub_drive_id: folder.driveId || null,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", projectId);

    return json(200, {
      provider: "gdrive" as Provider,
      rootId: folder.id,
      rootName: folder.name,
      rootWebUrl: folder.webViewLink,
      driveId: folder.driveId || null,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

