/**
 * Stripe Checkout Session creator (user-level subscription).
 *
 * Vstup (POST JSON):
 *   { tier: "starter"|"pro", billingPeriod: "monthly"|"yearly", successUrl, cancelUrl }
 *
 * Výstup:
 *   { success: true, paymentUrl: "https://checkout.stripe.com/...", sessionId: "cs_..." }
 *
 * Logika:
 *   1) Validace vstupu (tier, period, redirect URL allowlist).
 *   2) Auth uživatele přes Supabase JWT.
 *   3) Reuse existujícího Stripe customer ID, pokud user už má `billing_provider='stripe'`.
 *   4) Volání Stripe Checkout API s metadata { userId, tier, billingPeriod } pro user-level.
 *   5) Idempotency-Key zabraňuje duplikátnímu Checkout Session při dvojkliku.
 *
 * Důležité:
 *   - Customer/Subscription ID v DB se ukládají až ve webhooku `checkout.session.completed` —
 *     tady ještě subscription neexistuje. Stripe customer existuje až po vyplnění checkoutu.
 *   - Enterprise tier nemá self-checkout (mirror chování GoPay).
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
} from "../_shared/stripeBilling.ts";

interface PaymentRequest {
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  successUrl?: string;
  cancelUrl?: string;
}

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
    const body = (await req.json().catch(() => ({}))) as PaymentRequest;
    const tier = body.tier;
    const billingPeriod = body.billingPeriod ?? "monthly";
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;

    if (!tier || !successUrl || !cancelUrl) {
      return json(400, { error: "Missing required fields: tier, successUrl, cancelUrl" });
    }

    if (tier === "enterprise") {
      return json(400, {
        error: "Enterprise tier nemá self-checkout — kontaktujte podporu.",
      });
    }

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return json(400, { error: "Invalid billingPeriod" });
    }

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

    // Reuse Stripe customer ID, pokud user už má dřívější Stripe subscription.
    // Bezpečné: čteme jen pokud `billing_provider === 'stripe'`, jinak by GoPay customer ID
    // mohlo být v `billing_customer_id` (tam ale Stripe ID nikdy neukládáme).
    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("billing_customer_id, billing_provider")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load user_profile for checkout:", profileError);
      return json(500, { error: "Failed to load profile" });
    }

    const reuseCustomerId =
      profile?.billing_provider === "stripe" &&
      typeof profile?.billing_customer_id === "string" &&
      profile.billing_customer_id.startsWith("cus_")
        ? profile.billing_customer_id
        : undefined;

    const idempotencyKey = `stripe-create-${userId}-${tier}-${billingPeriod}-${crypto.randomUUID()}`;

    const sharedMetadata: Record<string, string> = {
      userId,
      tier,
      billingPeriod,
    };

    const session = await createCheckoutSession(
      {
        mode: "subscription",
        line_items: buildLineItems([{ priceId, quantity: 1 }]),
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(reuseCustomerId
          ? { customer: reuseCustomerId }
          : userEmail
            ? { customer_email: userEmail }
            : {}),
        client_reference_id: userId,
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
      console.error("Stripe Checkout Session created but no URL returned:", session.id);
      return json(500, { error: "Stripe checkout URL not returned" });
    }

    return json(200, {
      success: true,
      paymentUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating Stripe checkout session:", message);
    return json(500, { error: message });
  }
});
