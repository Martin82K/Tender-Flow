import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type Action = "status" | "disconnect";

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const action = body?.action as Action | undefined;
    if (!projectId) return json(req, 400, { error: "Missing projectId" });
    if (action !== "status" && action !== "disconnect") {
      return json(req, 400, { error: "Invalid action" });
    }

    const { data: project, error: projectError } = await authed
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json(req, 403, { error: "Forbidden" });
    if (!project.owner_id) return json(req, 403, { error: "Forbidden" });

    if (project.owner_id !== userData.user.id) {
      const { data: share, error: shareError } = await authed
        .from("project_shares")
        .select("project_id")
        .eq("project_id", projectId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (shareError || !share) return json(req, 403, { error: "Forbidden" });
    }

    const service = createServiceClient();
    if (action === "disconnect") {
      const { error } = await service
        .from("dochub_user_tokens")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("provider", "onedrive")
        .eq("access_kind", "personal_read");
      if (error) return json(req, 500, { error: "Connection could not be removed" });
      return json(req, 200, { connected: false });
    }

    const { data: token, error: tokenError } = await service
      .from("dochub_user_tokens")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .eq("provider", "onedrive")
      .eq("access_kind", "personal_read")
      .maybeSingle();
    if (tokenError) return json(req, 500, { error: "Connection status unavailable" });
    return json(req, 200, { connected: !!token });
  } catch {
    return json(req, 500, { error: "Connection request failed" });
  }
});
