import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

const json = (status: number, body: unknown) =>
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
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (!projectId) return json(400, { error: "Missing projectId" });

    // Fetch project, demand_categories, and bids in parallel
    const [projectRes, categoriesRes] = await Promise.all([
      authed
        .from("projects")
        .select("id,name,location,status,finish_date,investor")
        .eq("id", projectId)
        .single(),
      authed
        .from("demand_categories")
        .select("id,title,status,deadline,budget_display,plan_budget")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (projectRes.error) return json(500, { error: projectRes.error.message });
    if (!projectRes.data) return json(404, { error: "Project not found" });

    const categoryIds = (categoriesRes.data || []).map((c: any) => c.id);

    // Fetch bids for all demand categories
    let bids: any[] = [];
    if (categoryIds.length > 0) {
      const bidsRes = await authed
        .from("bids")
        .select("id,category_id,subcontractor_id,price,status")
        .in("category_id", categoryIds);
      if (!bidsRes.error) {
        bids = bidsRes.data || [];
      }
    }

    const project = {
      id: projectRes.data.id,
      name: projectRes.data.name,
      location: projectRes.data.location || null,
      status: projectRes.data.status || null,
      finishDate: projectRes.data.finish_date || null,
      investor: projectRes.data.investor || null,
    };

    const demandCategories = (categoriesRes.data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status || null,
      deadline: row.deadline || null,
      budgetDisplay: row.budget_display || null,
      planBudget: row.plan_budget || null,
    }));

    const mappedBids = bids.map((row: any) => ({
      id: row.id,
      categoryId: row.category_id,
      subcontractorId: row.subcontractor_id,
      price: row.price || null,
      status: row.status || null,
    }));

    return json(200, { project, demandCategories, bids: mappedBids });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
