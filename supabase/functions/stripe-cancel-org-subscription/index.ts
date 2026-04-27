/**
 * Stripe — zrušení org-level subscription (cancel at period end).
 *
 * Logika:
 *   1) Auth uživatele přes Supabase JWT.
 *   2) RBAC: jen `owner` org smí cancel — `admin` nestačí (mirror gopay-cancel-org-subscription).
 *   3) Načte org `billing_customer_id` (musí být `cus_…`); pro Stripe potřebujeme
 *      reálné subscription ID, které není v `organizations` tabulce —
 *      retrieveuje se přes `customer.subscriptions.list()` ekvivalent
 *      (dotaz pro aktivní/active subscription daného customeru).
 *   4) Volá Stripe API `subscriptions.update(cancel_at_period_end: true)`.
 *   5) Aktualizuje `organizations.subscription_status='cancelled'` a zapíše audit log
 *      (`change_type='stripe_org_cancel_recurrence'`).
 *
 * Subscription zůstává `active` až do `current_period_end`; expiraci řeší webhook
 * `customer.subscription.deleted`.
 *
 * Poznámka: protože organizations nemá `billing_subscription_id` sloupec, dotahujeme
 * subscription ID dynamicky z Stripe (jeden API call navíc, ale defenzivnější —
 * funguje i po manuální změně subscription v Dashboardu).
 */

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  cancelSubscriptionAtPeriodEnd,
  stripeFetch,
  validateStripeId,
} from "../_shared/stripeBilling.ts";

interface SubscriptionListResponse {
  data: Array<{ id: string; status: string }>;
}

/**
 * Najde aktivní/trialing subscription pro daný Stripe customer.
 * Vrací `null` pokud customer nemá žádnou ne-cancelled subscription.
 */
const findActiveSubscriptionForCustomer = async (
  customerId: string,
): Promise<string | null> => {
  // Stripe `GET /subscriptions?customer=cus_…&status=all&limit=10`
  // Vyfiltrujeme jen active/trialing/past_due (ty jsou stále "živé", lze cancel).
  const path =
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`;
  const response = await stripeFetch<SubscriptionListResponse>("GET", path);
  const live = response.data.find((s) =>
    s.status === "active" ||
    s.status === "trialing" ||
    s.status === "past_due" ||
    s.status === "unpaid" ||
    s.status === "incomplete"
  );
  return live?.id ?? null;
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

    if (!membership || membership.role !== "owner") {
      return json(403, { error: "Only organization owner can cancel billing" });
    }

    const { data: org, error: orgError } = await service
      .from("organizations")
      .select("billing_customer_id")
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
      return json(400, {
        success: false,
        error: "No active Stripe subscription found for organization",
      });
    }

    const subscriptionId = await findActiveSubscriptionForCustomer(customerId);
    if (!subscriptionId) {
      return json(400, {
        success: false,
        error: "No active Stripe subscription found for organization",
      });
    }

    const idempotencyKey = `stripe-cancel-org-${orgId}-${subscriptionId}`;

    await cancelSubscriptionAtPeriodEnd(subscriptionId, idempotencyKey);

    const { error: updateError } = await service
      .from("organizations")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (updateError) {
      console.error("Failed to update org cancellation status:", updateError);
      return json(500, { error: "Failed to update organization status" });
    }

    const { error: auditError } = await service
      .from("subscription_audit_log")
      .insert({
        user_id: userId,
        changed_by: userId,
        old_tier: null,
        new_tier: null,
        change_type: "stripe_org_cancel_recurrence",
        notes:
          `Org ${orgId}: cancel at period end requested for Stripe subscription ${subscriptionId} (customer ${customerId}).`,
      });

    if (auditError) {
      console.error("Failed to write audit log (org cancel):", auditError);
    }

    return json(200, {
      success: true,
      message: "Předplatné organizace bude zrušeno na konci aktuálního období.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error cancelling Stripe org subscription:", message);
    return json(500, { error: message });
  }
});
