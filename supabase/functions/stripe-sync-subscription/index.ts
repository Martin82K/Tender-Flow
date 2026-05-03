/**
 * Stripe — vynucená synchronizace user-level subscription z Stripe API do DB.
 *
 * Použití: uživatel klikne "Synchronizovat předplatné" v UI; nezávisle na webhoocích
 * stáhne aktuální stav ze Stripe a přepíše DB. Slouží jako recovery pro případy,
 * kdy webhook selže nebo se zpozdí.
 *
 * Logika:
 *   1) Auth user.
 *   2) Načte `billing_subscription_id` (sub_…) — pokud chybí, nic nesynchronizovat.
 *   3) Volá Stripe `GET /subscriptions/{id}`.
 *   4) Mapuje status, expires_at, cancel_at_period_end, tier (z metadata).
 *   5) Update `user_profiles` + audit log `change_type='stripe_sync'`.
 */

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  mapStripeSubscriptionStatusToInternal,
  parseStripeMetadata,
  retrieveSubscription,
  stripePeriodEndToDate,
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
      .select(
        "billing_subscription_id, billing_customer_id, billing_provider, subscription_tier",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load billing profile:", profileError);
      return json(500, { error: "Failed to load billing profile" });
    }

    if (!profile || profile.billing_provider !== "stripe") {
      return json(200, {
        success: true,
        message: "No Stripe subscription, nothing to sync",
        subscription: null,
      });
    }

    const subscriptionId = profile.billing_subscription_id as string | null;
    if (!subscriptionId || !validateStripeId(subscriptionId, "subscription")) {
      return json(200, {
        success: true,
        message: "No valid Stripe subscription ID, nothing to sync",
        subscription: null,
      });
    }

    const subscription = await retrieveSubscription(subscriptionId);

    const metadata = parseStripeMetadata(subscription.metadata ?? null);
    const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);
    const expiresAt =
      internalStatus === "expired"
        ? null
        : stripePeriodEndToDate(subscription.current_period_end);

    const tierFromMeta = metadata.tier;
    const oldTier = (profile.subscription_tier as string | null) ?? null;
    const newTier =
      internalStatus === "expired" ? "free" : (tierFromMeta ?? oldTier ?? "starter");

    const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

    const updateData: Record<string, unknown> = {
      stripe_subscription_tier: newTier,
      subscription_status: internalStatus,
      subscription_cancel_at_period_end: cancelAtPeriodEnd,
      subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
      billing_provider: "stripe",
      billing_subscription_id: subscription.id,
      billing_customer_id: subscription.customer ?? profile.billing_customer_id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await service
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update user profile:", updateError);
      return json(500, { error: "Failed to update subscription data" });
    }

    const { error: auditError } = await service
      .from("subscription_audit_log")
      .insert({
        user_id: userId,
        changed_by: userId,
        old_tier: oldTier,
        new_tier: newTier,
        change_type: "stripe_sync",
        notes: `Synced from Stripe: subscription=${subscription.id}, status=${subscription.status}, cancelAtPeriodEnd=${cancelAtPeriodEnd}`,
      });

    if (auditError) {
      console.error("Failed to write audit log:", auditError);
    }

    return json(200, {
      success: true,
      message: "Předplatné synchronizováno.",
      subscription: {
        id: subscription.id,
        tier: newTier,
        status: internalStatus,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing Stripe subscription:", message);
    return json(500, { error: message });
  }
});
