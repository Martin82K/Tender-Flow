import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  type Tier,
  createPayment,
  getNotificationUrl,
  getPlanAmount,
  getPlanDescription,
  getRecurrenceEndDate,
  getRecurrencePeriod,
  persistBillingIds,
  validateAllowedRedirectUrl,
} from "../_shared/gopayBilling.ts";

interface PaymentRequest {
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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

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

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return json(400, { error: "Invalid billingPeriod" });
    }

    const amount = getPlanAmount(tier, billingPeriod);
    if (!amount) {
      return json(400, { error: "Plan pricing not configured for requested tier" });
    }

    if (!validateAllowedRedirectUrl(successUrl) || !validateAllowedRedirectUrl(cancelUrl)) {
      return json(400, { error: "Redirect URL is not allowed" });
    }

    const goId = Deno.env.get("GOPAY_GOID");
    if (!goId) {
      return json(500, { error: "GoPay not configured (missing GOPAY_GOID)" });
    }

    // Authenticate user
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || "";
    const orderNumber = `TF-${userId.slice(0, 8)}-${tier}-${Date.now()}`;

    // Create GoPay payment with recurrence
    const paymentResponse = await createPayment({
      amount,
      currency: "CZK",
      order_number: orderNumber,
      order_description: getPlanDescription(tier, billingPeriod),
      payer: {
        email: userEmail,
        allowed_payment_instruments: [
          "PAYMENT_CARD",
          "APPLE_PAY",
          "GPAY",
          "BANK_ACCOUNT",
        ],
        contact: {
          email: userEmail,
        },
      },
      target: {
        type: "ACCOUNT",
        goid: Number(goId),
      },
      callback: {
        return_url: successUrl,
        notification_url: getNotificationUrl(),
      },
      recurrence: {
        recurrence_cycle: "MONTH",
        recurrence_period: getRecurrencePeriod(billingPeriod),
        recurrence_date_to: getRecurrenceEndDate(),
      },
      additional_params: [
        { name: "userId", value: userId },
        { name: "tier", value: tier },
        { name: "billingPeriod", value: billingPeriod },
      ],
      items: [
        {
          type: "ITEM",
          name: getPlanDescription(tier, billingPeriod),
          amount,
          count: 1,
        },
      ],
      lang: "CS",
    });

    if (!paymentResponse.gw_url) {
      console.error("GoPay payment created but no gw_url returned:", paymentResponse);
      return json(500, { error: "Payment gateway URL not returned" });
    }

    // Store payment ID for future reference
    const service = createServiceClient();
    await persistBillingIds(service, userId, paymentResponse.id);

    return json(200, {
      success: true,
      paymentUrl: paymentResponse.gw_url,
      paymentId: String(paymentResponse.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating GoPay payment:", message);
    return json(500, { error: message });
  }
});
