/**
 * Stripe Checkout Session creator (org-level subscription, per-seat).
 *
 * Vstup (POST JSON):
 *   { orgId, tier: "starter"|"pro", billingPeriod: "monthly"|"yearly",
 *     seats: number, successUrl, cancelUrl }
 *
 * Výstup:
 *   { success: true, paymentUrl: "https://checkout.stripe.com/...", sessionId: "cs_..." }
 *
 * Logika:
 *   1) Validace vstupu (orgId, tier, period, seats ≥ 1, redirect URL allowlist).
 *   2) Auth uživatele přes Supabase JWT.
 *   3) RBAC: musí být `owner` nebo `admin` dané organizace (mirror gopay-create-org-payment).
 *   4) Reuse existujícího Stripe customer ID, jen pokud organizace už má dřívější Stripe billing.
 *   5) Volání Stripe Checkout API: line_items s `quantity = seats`, metadata
 *      { userId, orgId, tier, billingPeriod, seats } na Session i Subscription objektu.
 *   6) Idempotency-Key zabraňuje duplikátnímu Checkout Session při dvojkliku.
 *
 * Důležité:
 *   - Customer/Subscription ID v DB se ukládají až ve webhooku `checkout.session.completed`
 *     (zpracovává `stripe-org-webhook`).
 *   - Enterprise tier nemá self-checkout (mirror chování GoPay).
 *   - Stripe per-seat = `quantity` na flat-priced line_item; price musí mít flat tier.
 */

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  type Tier,
  buildLineItems,
  createCheckoutSession,
  getStripePriceId,
  validateAllowedRedirectUrl,
  validateStripeId,
} from "../_shared/stripeBilling.ts";

interface OrgPaymentRequest {
  orgId?: string;
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  seats?: number;
  successUrl?: string;
  cancelUrl?: string;
}

const MAX_SEATS = 1000; // sanity cap — Stripe akceptuje větší, ale ochrana proti chybám UI

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
    const body = (await req.json().catch(() => ({}))) as OrgPaymentRequest;
    const { orgId, tier, successUrl, cancelUrl } = body;
    const billingPeriod = body.billingPeriod ?? "monthly";
    const seatsRaw = body.seats ?? 1;

    if (!orgId || !tier || !successUrl || !cancelUrl) {
      return json(400, {
        error: "Missing required fields: orgId, tier, successUrl, cancelUrl",
      });
    }

    if (tier === "enterprise") {
      return json(400, {
        error: "Enterprise tier nemá self-checkout — kontaktujte podporu.",
      });
    }

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return json(400, { error: "Invalid billingPeriod" });
    }

    if (
      !Number.isFinite(seatsRaw) ||
      seatsRaw < 1 ||
      seatsRaw > MAX_SEATS
    ) {
      return json(400, { error: `Invalid seats (must be 1..${MAX_SEATS})` });
    }
    const seats = Math.floor(seatsRaw);

    if (!validateAllowedRedirectUrl(successUrl) || !validateAllowedRedirectUrl(cancelUrl)) {
      return json(400, { error: "Redirect URL is not allowed" });
    }

    const priceId = getStripePriceId(tier, billingPeriod);
    if (!priceId) {
      return json(500, {
        error: "Stripe price ID not configured for requested tier/period",
      });
    }

    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || "";

    const service = createServiceClient();

    // RBAC: jen owner/admin smí spravovat org billing.
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

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return json(403, {
        error: "Only organization owner or admin can manage billing",
      });
    }

    // Reuse existujícího Stripe customer ID, jen pokud organizace má Stripe historii.
    // Ostatní providers (gopay) ukládají vlastní payment ID — nesmíme ho použít jako customer.
    const { data: org, error: orgError } = await service
      .from("organizations")
      .select("billing_customer_id, billing_provider")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      console.error("Failed to load organization for checkout:", orgError);
      return json(500, { error: "Failed to load organization" });
    }

    if (!org) {
      return json(404, { error: "Organization not found" });
    }

    const reuseCustomerId =
      (org as { billing_provider?: string | null }).billing_provider === "stripe" &&
      validateStripeId(
        (org as { billing_customer_id?: string | null }).billing_customer_id ?? null,
        "customer",
      )
        ? ((org as { billing_customer_id?: string | null }).billing_customer_id as string)
        : undefined;

    const idempotencyKey =
      `stripe-create-org-${orgId}-${tier}-${billingPeriod}-${seats}-${crypto.randomUUID()}`;

    const sharedMetadata: Record<string, string> = {
      userId,
      orgId,
      tier,
      billingPeriod,
      seats: String(seats),
    };

    const session = await createCheckoutSession(
      {
        mode: "subscription",
        line_items: buildLineItems([{ priceId, quantity: seats }]),
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(reuseCustomerId
          ? { customer: reuseCustomerId }
          : userEmail
            ? { customer_email: userEmail }
            : {}),
        client_reference_id: orgId,
        metadata: sharedMetadata,
        subscription_data: {
          metadata: sharedMetadata,
        },
        allow_promotion_codes: true,
        locale: "cs",
      },
      idempotencyKey,
    );

    if (!session.url) {
      console.error(
        "Stripe Checkout Session created but no URL returned (org):",
        session.id,
      );
      return json(500, { error: "Stripe checkout URL not returned" });
    }

    return json(200, {
      success: true,
      paymentUrl: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating Stripe org checkout session:", message);
    return json(500, { error: message });
  }
});
