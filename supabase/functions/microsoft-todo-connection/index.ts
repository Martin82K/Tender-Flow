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
    const action = body?.action as Action | undefined;
    if (action !== "status" && action !== "disconnect") {
      return json(req, 400, { error: "Invalid action" });
    }

    const service = createServiceClient();
    const userId = userData.user.id;

    if (action === "disconnect") {
      const cleanupResults = await Promise.all([
        service.from("dochub_user_tokens").delete()
          .eq("user_id", userId)
          .eq("provider", "onedrive")
          .eq("access_kind", "todo_sync"),
        service.from("microsoft_todo_list_mappings").delete().eq("user_id", userId),
        service.from("microsoft_todo_tombstones").delete().eq("user_id", userId),
        service.from("microsoft_todo_sync_locks").delete().eq("user_id", userId),
      ]);
      if (cleanupResults.some((result) => result.error)) {
        return json(req, 500, { error: "TODO connection could not be removed" });
      }
      return json(req, 200, { connected: false });
    }

    const [{ data: token, error: tokenError }, { data: mappings, error: mappingError }] = await Promise.all([
      service.from("dochub_user_tokens")
        .select("user_id, updated_at")
        .eq("user_id", userId)
        .eq("provider", "onedrive")
        .eq("access_kind", "todo_sync")
        .maybeSingle(),
      service.from("microsoft_todo_list_mappings")
        .select("last_synced_at, sync_error")
        .eq("user_id", userId),
    ]);
    if (tokenError || mappingError) {
      return json(req, 500, { error: "TODO connection status unavailable" });
    }

    const rows = mappings ?? [];
    const lastSyncedAt = rows
      .map((row) => row.last_synced_at as string | null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const syncError = rows.find((row) => row.sync_error)?.sync_error ?? null;

    return json(req, 200, {
      connected: Boolean(token),
      lastSyncedAt,
      syncError,
    });
  } catch {
    return json(req, 500, { error: "TODO connection request failed" });
  }
});
