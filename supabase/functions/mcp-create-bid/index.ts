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
    const demandCategoryId = typeof body?.demandCategoryId === "string" ? body.demandCategoryId : null;
    const subcontractorId = typeof body?.subcontractorId === "string" ? body.subcontractorId : null;

    if (!demandCategoryId || !subcontractorId) {
      return json(400, { error: "Missing required fields: demandCategoryId, subcontractorId" });
    }

    // Verify the demand category exists
    const { data: category, error: catError } = await authed
      .from("demand_categories")
      .select("id")
      .eq("id", demandCategoryId)
      .single();
    if (catError || !category) {
      return json(404, { error: "Demand category not found" });
    }

    // Generate UUID for the bid
    const id = crypto.randomUUID();
    const status_value = body.status || "sent";

    const { data, error } = await authed
      .from("bids")
      .insert({
        id,
        category_id: demandCategoryId,
        subcontractor_id: subcontractorId,
        price: body.price ?? null,
        price_display: body.priceDisplay ?? null,
        notes: body.notes ?? null,
        status: status_value,
      })
      .select("id,category_id,subcontractor_id,status")
      .single();

    if (error) return json(500, { error: error.message });

    return json(201, {
      id: data.id,
      categoryId: data.category_id,
      subcontractorId: data.subcontractor_id,
      status: data.status,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
