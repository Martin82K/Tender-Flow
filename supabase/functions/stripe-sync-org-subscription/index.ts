/**
 * Stripe — vynucená synchronizace org-level subscription z Stripe API do DB.
 *
 * Použití: člen organizace klikne "Synchronizovat předplatné"; nezávisle na webhoocích
 * stáhne aktuální stav ze Stripe a přepíše `organizations` row.
 *
 * Logika:
 *   1) Auth user.
 *   2) Member-only: jakýkoli member orgu smí trigger sync (read-only operace, jen mirror
 *      gopay-sync-org-subscription, kde stačí membership bez owner/admin role).
 *   3) Načte org `billing_customer_id` (cus_…). Pokud chybí, nic nesynchronizovat.
 *   4) Najde aktivní subscription pro daný customer (`GET /subscriptions?customer=...`).
 *   5) Mapuje status, expires_at, tier, max_seats, billing_period.
 *   6) Update `organizations` + audit log `change_type='stripe_sync'`.
 *
 * Recovery flow pro případ ztracených webhooků.
 */

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type Tier,
  mapStripeSubscriptionStatusToInternal,
  parseStripeMetadata,
  retrieveSubscription,
  stripeFetch,
  stripePeriodEndToDate,
  validateStripeId,
} from "../_shared/stripeBilling.ts";

interface SubscriptionListResponse {
  data: Array<{ id: string; status: string }>;
}

const findLatestSubscriptionForCustomer = async (
  customerId: string,
): Promise<string | null> => {
  const path =
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`;
  const response = await stripeFetch<SubscriptionListResponse>("GET", path);
  // Preferuj live status; pokud žádný, vezmi první (nejnovější dle Stripe ordering).
  const live = response.data.find((s) =>
    s.status === "active" ||
    s.status === "trialing" ||
    s.status === "past_due" ||
    s.status === "unpaid" ||
    s.status === "incomplete"
  );
  return live?.id ?? response.data[0]?.id ?? null;
};

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
    const body = (await req.json().catch(() => ({}))) as { orgId?: string };
    const orgId = body.orgId;

    if (!orgId) {
      return json(400, { error: "Missing orgId" });
    }

    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    const { data: membership, error: membershipError } = await service
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("Failed to load organization membership:", membershipError);
      return json(500, { error: "Failed to verify organization access" });
    }

    if (!membership) {
      return json(403, { error: "Not a member of this organization" });
    }

    const { data: org, error: orgError } = await service
      .from("organizations")
      .select("billing_customer_id, subscription_tier, max_seats, billing_period")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      console.error("Failed to load organization:", orgError);
      return json(500, { error: "Failed to load organization" });
    }

    if (!org) {
      return json(404, { error: "Organization not found" });
    }

    const customerId = (org as { billing_customer_id?: string | null }).billing_customer_id ?? null;
    if (!customerId || !validateStripeId(customerId, "customer")) {
      return json(200, {
        success: true,
        message: "No Stripe customer for this organization, nothing to sync",
        subscription: null,
      });
    }

    const subscriptionId = await findLatestSubscriptionForCustomer(customerId);
    if (!subscriptionId) {
      return json(200, {
        success: true,
        message: "Customer has no Stripe subscription, nothing to sync",
        subscription: null,
      });
    }

    const subscription = await retrieveSubscription(subscriptionId);
    const metadata = parseStripeMetadata(subscription.metadata ?? null);
    const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);

    const oldTier = (org as { subscription_tier?: string | null }).subscription_tier ?? null;
    const newTier: Tier | "free" =
      internalStatus === "expired"
        ? "free"
        : ((metadata.tier ?? oldTier ?? "starter") as Tier);

    const expiresAt =
      internalStatus === "expired"
        ? null
        : stripePeriodEndToDate(subscription.current_period_end);

    const item = subscription.items?.data?.[0];
    const seatsFromItem =
      typeof item?.quantity === "number" && item.quantity > 0 ? item.quantity : null;
    const oldSeats = (org as { max_seats?: number | null }).max_seats ?? null;
    const newSeats =
      internalStatus === "expired"
        ? oldSeats
        : (seatsFromItem ?? metadata.seats ?? oldSeats);

    const recurringInterval = item?.price?.recurring?.interval;
    const oldBillingPeriod = (org as { billing_period?: string | null }).billing_period ?? null;
    const newBillingPeriod =
      recurringInterval === "year"
        ? "yearly"
        : recurringInterval === "month"
          ? "monthly"
          : (metadata.billingPeriod ?? oldBillingPeriod);

    const updateData: Record<string, unknown> = {
      subscription_tier: newTier,
      subscription_status: internalStatus,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      billing_customer_id: subscription.customer ?? customerId,
      updated_at: new Date().toISOString(),
    };
    if (newSeats !== null && newSeats > 0) updateData.max_seats = newSeats;
    if (newBillingPeriod) updateData.billing_period = newBillingPeriod;

    const { error: updateError } = await service
      .from("organizations")
      .update(updateData)
      .eq("id", orgId);

    if (updateError) {
      console.error("Failed to update organization:", updateError);
      return json(500, { error: "Failed to update organization data" });
    }

    const { error: auditError } = await service
      .from("subscription_audit_log")
      .insert({
        user_id: userId,
        changed_by: userId,
        old_tier: oldTier,
        new_tier: newTier,
        change_type: "stripe_sync",
        notes:
          `Synced org ${orgId} from Stripe: subscription=${subscription.id}, status=${subscription.status}, seats=${newSeats ?? "n/a"}, period=${newBillingPeriod ?? "n/a"}`,
      });

    if (auditError) {
      console.error("Failed to write audit log (org sync):", auditError);
    }

    return json(200, {
      success: true,
      message: "Předplatné organizace synchronizováno.",
      subscription: {
        id: subscription.id,
        tier: newTier,
        status: internalStatus,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        seats: newSeats,
        billingPeriod: newBillingPeriod,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing Stripe org subscription:", message);
    return json(500, { error: message });
  }
});
