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

    const [projectRes, categoriesRes, planRes] = await Promise.all([
      authed
        .from("projects")
        .select("id,finish_date")
        .eq("id", projectId)
        .maybeSingle(),
      authed
        .from("demand_categories")
        .select("id,title,deadline,realization_start,realization_end")
        .eq("project_id", projectId),
      authed
        .from("tender_plans")
        .select("id,name,date_from,date_to,category_id")
        .eq("project_id", projectId),
    ]);

    if (projectRes.error) return json(500, { error: projectRes.error.message });
    if (categoriesRes.error) return json(500, { error: categoriesRes.error.message });
    if (planRes.error) return json(500, { error: planRes.error.message });

    return json(200, {
      projectId,
      finishDate: projectRes.data?.finish_date || null,
      tenderStages: (categoriesRes.data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        deadline: row.deadline || null,
        realizationStart: row.realization_start || null,
        realizationEnd: row.realization_end || null,
      })),
      tenderPlan: (planRes.data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        dateFrom: row.date_from || null,
        dateTo: row.date_to || null,
        categoryId: row.category_id || null,
      })),
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
