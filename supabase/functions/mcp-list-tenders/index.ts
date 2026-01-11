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

    let query = authed
      .from("demand_categories")
      .select(
        "id,project_id,title,status,deadline,realization_start,realization_end,budget_display,plan_budget"
      )
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) return json(500, { error: error.message });

    const items =
      (data || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        status: row.status || null,
        deadline: row.deadline || null,
        realizationStart: row.realization_start || null,
        realizationEnd: row.realization_end || null,
        budgetDisplay: row.budget_display || null,
        planBudget: row.plan_budget || null,
      })) || [];

    return json(200, { items });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
