import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const sanitizeSearch = (value: string) =>
  value.replace(/[,]/g, " ").replace(/\s+/g, " ").trim();

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const rawSearch = typeof body?.search === "string" ? body.search : "";
    const search = sanitizeSearch(rawSearch);

    let query = authed
      .from("projects")
      .select("id,name,location,status,finish_date")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return json(500, { error: error.message });

    const items =
      (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        location: row.location || "",
        status: row.status || null,
        finishDate: row.finish_date || null,
      })) || [];

    return json(200, { items });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
