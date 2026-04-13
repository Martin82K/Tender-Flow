import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  getAdditionalParam,
  getPaymentStatus,
  loadBillingProfile,
} from "../_shared/gopayBilling.ts";

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
    // Authenticate user
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    // Get user's GoPay payment ID from DB
    const profile = await loadBillingProfile(service, userId);
    const paymentId = profile?.billing_subscription_id;

    if (!paymentId) {
      return json(200, {
        success: true,
        message: "No payment found, nothing to sync",
        subscription: null,
      });
    }

    // Query GoPay for current payment status
    const payment = await getPaymentStatus(paymentId);
    const isUnpaidState =
      payment.state === "CREATED" ||
      payment.state === "PAYMENT_METHOD_CHOSEN" ||
      payment.state === "AUTHORIZED";

    if (isUnpaidState) {
      return json(200, {
        success: true,
        message: "Payment is not settled yet, nothing to sync.",
        subscription: {
          id: paymentId,
          state: payment.state,
        },
      });
    }

    const tier =
      getAdditionalParam(payment.additional_params, "tier") || "starter";

    // Map GoPay state to subscription status
    let status: "active" | "cancelled" | "expired" = "active";
    const recurrenceState = payment.recurrence?.recurrence_state;

    if (payment.state === "CANCELED" || payment.state === "REFUNDED") {
      status = "expired";
    } else if (recurrenceState === "STOPPED") {
      // Recurrence was voided but payment is still PAID
      status = "cancelled";
    }

    // Calculate expiration from recurrence info
    let expiresAt: string | null = null;
    if (payment.recurrence?.recurrence_date_to && status !== "expired") {
      // Use recurrence_date_to as a rough proxy; the actual next charge
      // date is determined by GoPay internally
      // For a more accurate value, we use the last known subscription_expires_at
      // and only update if the payment state changed
      const { data: currentProfile } = await service
        .from("user_profiles")
        .select("subscription_expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      expiresAt = currentProfile?.subscription_expires_at || null;
    }

    const isCancelAtPeriodEnd =
      recurrenceState === "STOPPED" || status === "cancelled";

    // Update DB with fresh data
    const updateData: Record<string, unknown> = {
      stripe_subscription_tier:
        status === "expired" ? "free" : tier,
      subscription_status: status,
      subscription_cancel_at_period_end: isCancelAtPeriodEnd,
      billing_subscription_id: paymentId,
      billing_provider: "gopay",
      updated_at: new Date().toISOString(),
    };

    if (expiresAt) {
      updateData.subscription_expires_at = expiresAt;
    }

    const { error: updateError } = await service
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update user profile:", updateError);
      return json(500, { error: "Failed to update subscription data" });
    }

    // Audit log
    await service.from("subscription_audit_log").insert({
      user_id: userId,
      changed_by: userId,
      old_tier: null,
      new_tier: status === "expired" ? "free" : tier,
      change_type: "manual_sync",
      notes: `Synced from GoPay: payment=${paymentId}, state=${payment.state}, recurrence=${recurrenceState || "n/a"}`,
    });

    return json(200, {
      success: true,
      message: "Předplatné synchronizováno.",
      subscription: {
        id: paymentId,
        tier: status === "expired" ? "free" : tier,
        status,
        expiresAt,
        cancelAtPeriodEnd: isCancelAtPeriodEnd,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing GoPay subscription:", message);
    return json(500, { error: message });
  }
});
