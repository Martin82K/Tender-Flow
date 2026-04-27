import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  type Tier,
  createPayment,
  generateOrderNumber,
  getNotificationUrl,
  getPlanAmount,
  getPlanDescription,
  getRecurrenceEndDate,
  getRecurrencePeriod,
  validateAllowedRedirectUrl,
} from "../_shared/gopayBilling.ts";

interface OrgPaymentRequest {
  orgId?: string;
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  seats?: number;
  successUrl?: string;
  cancelUrl?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as OrgPaymentRequest;
    const { orgId, tier, successUrl, cancelUrl } = body;
    const billingPeriod = body.billingPeriod ?? "monthly";
    const seats = body.seats ?? 1;

    if (!orgId || !tier || !successUrl || !cancelUrl) {
      return json(400, { error: "Missing required fields: orgId, tier, successUrl, cancelUrl" });
    }

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return json(400, { error: "Invalid billingPeriod" });
    }

    const pricePerSeat = getPlanAmount(tier, billingPeriod);
    if (!pricePerSeat) {
      return json(400, { error: "Plan pricing not configured for requested tier" });
    }

    const amount = pricePerSeat * seats;

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

    // Verify user is owner/admin of the organization
    const service = createServiceClient();
    const { data: membership } = await service
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return json(403, { error: "Only organization owner or admin can manage billing" });
    }

    const orderNumber = generateOrderNumber("TF-ORG", orgId, tier);
    const description = `${getPlanDescription(tier, billingPeriod)} (${seats} seats)`;

    // Create GoPay payment with recurrence
    const paymentResponse = await createPayment({
      amount,
      currency: "CZK",
      order_number: orderNumber,
      order_description: description,
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
        { name: "orgId", value: orgId },
        { name: "userId", value: userId },
        { name: "tier", value: tier },
        { name: "billingPeriod", value: billingPeriod },
        { name: "seats", value: String(seats) },
      ],
      items: [
        {
          type: "ITEM",
          name: description,
          amount,
          count: 1,
        },
      ],
      lang: "CS",
    });

    if (!paymentResponse.gw_url) {
      console.error("GoPay org payment created but no gw_url returned:", paymentResponse);
      return json(500, { error: "Payment gateway URL not returned" });
    }

    // Store billing customer ID on organization
    await service
      .from("organizations")
      .update({ billing_customer_id: String(paymentResponse.id) })
      .eq("id", orgId);

    return json(200, {
      success: true,
      checkoutUrl: paymentResponse.gw_url,
      paymentUrl: paymentResponse.gw_url,
      paymentId: String(paymentResponse.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating GoPay org payment:", message);
    return json(500, { error: message });
  }
});
