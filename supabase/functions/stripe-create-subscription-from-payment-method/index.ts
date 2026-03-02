import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  type Tier,
  getOrCreateBillingCustomer,
  getPriceId,
  getStripeClient,
} from "../_shared/stripeBilling.ts";

interface CreateSubscriptionRequest {
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  paymentMethodId?: string;
  idempotencyKey?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const isTier = (tier: unknown): tier is Tier =>
  tier === "starter" || tier === "pro" || tier === "enterprise";

const isBillingPeriod = (period: unknown): period is BillingPeriod =>
  period === "monthly" || period === "yearly";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const stripe = getStripeClient();
  const service = createServiceClient();

  let requestRecordId: string | null = null;
  let idempotencyKey = "";
  let userId = "";

  try {
    const body = (await req.json().catch(() => ({}))) as CreateSubscriptionRequest;
    const tier = body.tier;
    const billingPeriod = body.billingPeriod ?? "monthly";
    const paymentMethodId = body.paymentMethodId;
    idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey || "";

    if (!isTier(tier) || !isBillingPeriod(billingPeriod) || !paymentMethodId) {
      return json(400, {
        error: "Missing required fields: tier, billingPeriod, paymentMethodId",
      });
    }

    if (!idempotencyKey || idempotencyKey.length < 8) {
      return json(400, { error: "Missing idempotency key" });
    }

    const priceId = getPriceId(tier, billingPeriod);
    if (!priceId) {
      return json(400, { error: "Stripe price ID not configured for requested plan" });
    }

    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    userId = userData.user.id;
    const fullName =
      (typeof userData.user.user_metadata?.name === "string" && userData.user.user_metadata.name) ||
      (typeof userData.user.user_metadata?.full_name === "string" && userData.user.user_metadata.full_name) ||
      (typeof userData.user.user_metadata?.display_name === "string" && userData.user.user_metadata.display_name) ||
      null;

    const { data: existingRequest, error: existingRequestError } = await service
      .from("billing_subscription_requests")
      .select("id, status, response")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingRequestError) {
      return json(500, { error: "Failed to load idempotency state" });
    }

    if (existingRequest) {
      if (existingRequest.status === "success" && existingRequest.response) {
        return json(200, existingRequest.response);
      }
      if (existingRequest.status === "processing") {
        return json(409, { error: "Request is already being processed" });
      }
      if (existingRequest.status === "failed") {
        return json(409, {
          error: "This idempotency key already failed. Use a new idempotency key for retry.",
          details: existingRequest.response ?? null,
        });
      }
    } else {
      const { data: insertedRequest, error: insertRequestError } = await service
        .from("billing_subscription_requests")
        .insert({
          user_id: userId,
          idempotency_key: idempotencyKey,
          tier,
          billing_period: billingPeriod,
          status: "processing",
        })
        .select("id")
        .single();

      if (insertRequestError) {
        if (insertRequestError.code === "23505") {
          return json(409, { error: "Duplicate idempotency request" });
        }
        return json(500, { error: "Failed to create idempotency record" });
      }

      requestRecordId = insertedRequest.id;
    }

    const customerId = await getOrCreateBillingCustomer({
      service,
      stripe,
      userId,
      email: userData.user.email,
      fullName,
    });

    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already attached")) {
        throw error;
      }
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId, quantity: 1 }],
        default_payment_method: paymentMethodId,
        payment_behavior: "default_incomplete",
        metadata: {
          userId,
          tier,
          billingPeriod,
          source: "wallet",
        },
        expand: ["latest_invoice.payment_intent"],
      },
      {
        idempotencyKey: `wallet_sub_${userId}_${idempotencyKey}`,
      },
    );

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;
    const requiresAction = paymentIntent?.status === "requires_action";

    const responsePayload = {
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      requiresAction,
      paymentIntentClientSecret: paymentIntent?.client_secret || null,
      message: requiresAction
        ? "Subscription requires additional authentication."
        : "Subscription created.",
    };

    const { error: updateProfileError } = await service
      .from("user_profiles")
      .update({
        stripe_customer_id: customerId,
        billing_customer_id: customerId,
        billing_subscription_id: subscription.id,
        billing_provider: "stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateProfileError) {
      throw new Error("Failed to update billing profile");
    }

    const { error: markSuccessError } = await service
      .from("billing_subscription_requests")
      .update({
        status: "success",
        stripe_subscription_id: subscription.id,
        response: responsePayload,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey);

    if (markSuccessError) {
      console.error("Failed to mark request success:", markSuccessError);
    }

    return json(200, responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create subscription from payment method:", message);

    if (idempotencyKey) {
      const updates = {
        status: "failed",
        response: { success: false, error: message },
        updated_at: new Date().toISOString(),
      };
      let failQuery = service
        .from("billing_subscription_requests")
        .update(updates)
        .eq("idempotency_key", idempotencyKey);
      if (requestRecordId) {
        failQuery = failQuery.eq("id", requestRecordId);
      }
      if (userId) {
        failQuery = failQuery.eq("user_id", userId);
      }
      const { error: markFailedError } = await failQuery;

      if (markFailedError) {
        console.error("Failed to mark request as failed:", markFailedError);
      }
    }

    return json(500, { error: message });
  }
});
