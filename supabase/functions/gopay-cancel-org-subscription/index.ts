import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { voidRecurrence } from "../_shared/gopayBilling.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { orgId?: string };
    const orgId = body.orgId;

    if (!orgId) {
      return json(400, { error: "Missing orgId" });
    }

    // Authenticate user
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    // Verify user is owner of the organization
    const { data: membership } = await service
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || membership.role !== "owner") {
      return json(403, { error: "Only organization owner can cancel billing" });
    }

    // Get org billing info
    const { data: org } = await service
      .from("organizations")
      .select("billing_customer_id")
      .eq("id", orgId)
      .single();

    const paymentId = org?.billing_customer_id;
    if (!paymentId) {
      return json(400, { success: false, error: "No active subscription found" });
    }

    // Cancel recurrence in GoPay
    await voidRecurrence(paymentId);

    // Update org — subscription stays active until expiration
    await service
      .from("organizations")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    // Audit log
    await service.from("subscription_audit_log").insert({
      user_id: userId,
      changed_by: userId,
      old_tier: null,
      new_tier: null,
      change_type: "gopay_org_cancel_recurrence",
      notes: `Org ${orgId}: recurrence cancelled for GoPay payment ${paymentId}`,
    });

    return json(200, {
      success: true,
      message: "Předplatné organizace bude zrušeno na konci aktuálního období.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error cancelling GoPay org subscription:", message);
    return json(500, { error: message });
  }
});
