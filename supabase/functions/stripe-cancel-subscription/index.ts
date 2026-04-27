/**
 * Stripe — zrušení user-level subscription (cancel at period end).
 *
 * Logika:
 *   1) Auth uživatele přes Supabase JWT.
 *   2) Načte `billing_subscription_id` (musí mít prefix `sub_…`) a ověří, že
 *      `billing_provider === 'stripe'`.
 *   3) Volá Stripe API `subscriptions.update(cancel_at_period_end: true)`.
 *      Stripe atomicky nastaví flag — žádný TOCTOU race.
 *   4) Aktualizuje `user_profiles.subscription_cancel_at_period_end = true`
 *      a zapíše audit log (`change_type='stripe_cancel_recurrence'`).
 *
 * Subscription zůstává `active` až do `current_period_end`. Real status update
 * přijde přes webhook `customer.subscription.deleted` až po vypršení období.
 */

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  cancelSubscriptionAtPeriodEnd,
  validateStripeId,
} from "../_shared/stripeBilling.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const corsHeaders = buildCorsHeaders(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("billing_subscription_id, billing_provider")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load billing profile:", profileError);
      return json(500, { error: "Failed to load billing profile" });
    }

    if (!profile || profile.billing_provider !== "stripe") {
      return json(400, {
        success: false,
        error: "No active Stripe subscription found",
      });
    }

    const subscriptionId = profile.billing_subscription_id as string | null;
    if (!subscriptionId || !validateStripeId(subscriptionId, "subscription")) {
      return json(400, {
        success: false,
        error: "Invalid or missing Stripe subscription ID",
      });
    }

    const idempotencyKey = `stripe-cancel-${userId}-${subscriptionId}`;

    await cancelSubscriptionAtPeriodEnd(subscriptionId, idempotencyKey);

    const { error: updateError } = await service
      .from("user_profiles")
      .update({
        subscription_cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update cancellation flag:", updateError);
      return json(500, { error: "Failed to update subscription status" });
    }

    const { error: auditError } = await service
      .from("subscription_audit_log")
      .insert({
        user_id: userId,
        changed_by: userId,
        old_tier: null,
        new_tier: null,
        change_type: "stripe_cancel_recurrence",
        notes: `Cancel at period end requested for Stripe subscription ${subscriptionId}.`,
      });

    if (auditError) {
      console.error("Failed to write audit log:", auditError);
    }

    return json(200, {
      success: true,
      message: "Předplatné bude zrušeno na konci aktuálního období.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error cancelling Stripe subscription:", message);
    return json(500, { error: message });
  }
});
