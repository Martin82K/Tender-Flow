import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type BillingPeriod = "monthly" | "yearly";
type Tier = "starter" | "pro" | "enterprise";

interface CheckoutRequest {
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  successUrl?: string;
  cancelUrl?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const getStripeClient = () => {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
};

const getPriceId = (tier: Tier, billingPeriod: BillingPeriod) => {
  const starterMonthly = Deno.env.get("STRIPE_PRICE_ID_STARTER_MONTHLY") || "";
  const starterYearly = Deno.env.get("STRIPE_PRICE_ID_STARTER_YEARLY") || "";
  const proMonthly = Deno.env.get("STRIPE_PRICE_ID_PRO_MONTHLY") || "";
  const proYearly = Deno.env.get("STRIPE_PRICE_ID_PRO_YEARLY") || "";
  const enterpriseMonthly = Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_MONTHLY") || "";
  const enterpriseYearly = Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_YEARLY") || "";

  if (tier === "starter" && billingPeriod === "monthly") return starterMonthly;
  if (tier === "starter" && billingPeriod === "yearly") return starterYearly;
  if (tier === "pro" && billingPeriod === "monthly") return proMonthly;
  if (tier === "pro" && billingPeriod === "yearly") return proYearly;
  if (tier === "enterprise" && billingPeriod === "monthly") return enterpriseMonthly;
  if (tier === "enterprise" && billingPeriod === "yearly") return enterpriseYearly;
  return "";
};

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

    const stripe = getStripeClient();
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const service = createServiceClient();
    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: "Failed to load user profile" });
    }

    let customerId = profile?.stripe_customer_id || "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.user.email || undefined,
        metadata: { userId: userData.user.id },
      });

      customerId = customer.id;
      const { error: updateError } = await service
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userData.user.id);

      if (updateError) {
        return json(500, { error: "Failed to store Stripe customer" });
      }
    }

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
      },
      subscription_data: {
        metadata: {
          userId: userData.user.id,
          tier,
          billingPeriod,
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
