import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

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

    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (!projectId) return json(400, { error: "Missing projectId" });

    const { data, error } = await authed
      .from("tender_plans")
      .select("id,name,date_from,date_to,category_id")
      .eq("project_id", projectId)
      .order("date_from", { ascending: true });

    if (error) return json(500, { error: error.message });

    const items =
      (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        dateFrom: row.date_from || null,
        dateTo: row.date_to || null,
        categoryId: row.category_id || null,
      })) || [];

    return json(200, { items });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
