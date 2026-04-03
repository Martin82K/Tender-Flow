import { createServiceClient } from "../_shared/supabase.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Edge Function: check-deadlines
 *
 * Checks demand_categories for approaching or overdue deadlines
 * and inserts notification records for the project owners.
 *
 * Intended to be called by pg_cron or an external scheduler daily.
 * Uses service_role to query all categories and insert notifications.
 *
 * Deadline windows: 7 days, 1 day, overdue (past deadline).
 */

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch categories with deadlines that are approaching or overdue
    // Join with projects to get the project owner and name
    const { data: categories, error } = await supabase
      .from("demand_categories")
      .select(`
        id,
        title,
        deadline,
        status,
        project_id,
        projects!inner (
          id,
          name,
          owner_id,
          status
        )
      `)
      .not("deadline", "is", null)
      .in("status", ["open", "negotiating"])
      .neq("projects.status", "archived");

    if (error) {
      console.error("Failed to fetch categories:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    let notificationsCreated = 0;

    for (const category of categories || []) {
      const deadline = new Date(category.deadline + "T00:00:00");
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Only notify for specific windows: overdue, 1 day, 7 days
      const shouldNotify =
        diffDays < 0 || // overdue
        diffDays === 0 || // today
        diffDays === 1 || // tomorrow
        diffDays === 7; // 7 days

      if (!shouldNotify) continue;

      const project = category.projects as any;
      const ownerId = project?.owner_id;
      if (!ownerId) continue;

      // Deduplicate: check if notification already exists for this entity+day
      const entityId = `${category.id}_${diffDays}_${todayStr}`;
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("entity_type", "deadline")
        .eq("entity_id", entityId)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Determine notification content
      let title: string;
      let type: string;

      if (diffDays < 0) {
        title = `Termin prosel: ${category.title}`;
        type = "warning";
      } else if (diffDays <= 1) {
        title = `Termin zitra: ${category.title}`;
        type = "warning";
      } else {
        title = `Termin za ${diffDays} dni: ${category.title}`;
        type = "info";
      }

      const { error: insertError } = await supabase.rpc("insert_notification", {
        target_user_id: ownerId,
        notif_type: type,
        notif_category: "deadline",
        notif_title: title,
        notif_body: project?.name ? `Projekt: ${project.name}` : null,
        notif_action_url: `/app/project?projectId=${project.id}&tab=pipeline&categoryId=${category.id}`,
        notif_entity_type: "deadline",
        notif_entity_id: entityId,
      });

      if (insertError) {
        console.error(`Failed to insert deadline notification for category ${category.id}:`, insertError);
      } else {
        notificationsCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categoriesChecked: categories?.length ?? 0,
        notificationsCreated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
