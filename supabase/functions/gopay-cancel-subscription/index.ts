import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { loadBillingProfile, voidRecurrence } from "../_shared/gopayBilling.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // Authenticate user
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    // Get billing profile
    const profile = await loadBillingProfile(service, userId);
    const paymentId = profile?.billing_subscription_id;

    if (!paymentId) {
      return json(400, {
        success: false,
        error: "No active subscription found",
      });
    }

    // Cancel recurrence in GoPay
    await voidRecurrence(paymentId);

    // Update profile — subscription stays active until expiration
    const { error: updateError } = await service
      .from("user_profiles")
      .update({
        subscription_cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update cancellation status:", updateError);
      return json(500, { error: "Failed to update subscription status" });
    }

    // Audit log
    await service.from("subscription_audit_log").insert({
      user_id: userId,
      changed_by: userId,
      old_tier: null,
      new_tier: null,
      change_type: "gopay_cancel_recurrence",
      notes: `Recurrence cancelled for GoPay payment ${paymentId}. Access continues until period end.`,
    });

    return json(200, {
      success: true,
      message: "Předplatné bude zrušeno na konci aktuálního období.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error cancelling GoPay subscription:", message);
    return json(500, { error: message });
  }
});
