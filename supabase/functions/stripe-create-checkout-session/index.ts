import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  type PaymentMethodPreference,
  type Tier,
  getOrCreateBillingCustomer,
  getPriceId,
  getStripeClient,
  validateAllowedRedirectUrl,
} from "../_shared/stripeBilling.ts";

interface CheckoutRequest {
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  successUrl?: string;
  cancelUrl?: string;
  paymentMethodPreference?: PaymentMethodPreference;
}

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
    const body = (await req.json().catch(() => ({}))) as CheckoutRequest;
    const tier = body.tier;
    const billingPeriod = body.billingPeriod ?? "monthly";
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    const paymentMethodPreference = body.paymentMethodPreference ?? "auto";

    if (!tier || !successUrl || !cancelUrl) {
      return json(400, { error: "Missing required fields: tier, successUrl, cancelUrl" });
    }

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return json(400, { error: "Invalid billingPeriod" });
    }

    const priceId = getPriceId(tier, billingPeriod);
    if (!priceId) {
      return json(400, { error: "Stripe price ID not configured for requested plan" });
    }

    if (!validateAllowedRedirectUrl(successUrl) || !validateAllowedRedirectUrl(cancelUrl)) {
      return json(400, { error: "Redirect URL is not allowed" });
    }

    if (paymentMethodPreference !== "auto" && paymentMethodPreference !== "wallet_first") {
      return json(400, { error: "Invalid paymentMethodPreference" });
    }

    const stripe = getStripeClient();
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const fullName =
      (typeof userData.user.user_metadata?.name === "string" && userData.user.user_metadata.name) ||
      (typeof userData.user.user_metadata?.full_name === "string" && userData.user.user_metadata.full_name) ||
      (typeof userData.user.user_metadata?.display_name === "string" && userData.user.user_metadata.display_name) ||
      null;

    const service = createServiceClient();
    const customerId = await getOrCreateBillingCustomer({
      service,
      stripe,
      userId: userData.user.id,
      email: userData.user.email,
      fullName,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: userData.user.id,
      metadata: {
        userId: userData.user.id,
        tier,
        billingPeriod,
        paymentMethodPreference,
      },
      subscription_data: {
        metadata: {
          userId: userData.user.id,
          tier,
          billingPeriod,
          paymentMethodPreference,
        },
      },
    });

    return json(200, {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
