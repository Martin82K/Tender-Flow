import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  getAdditionalParam,
  getPaymentStatus,
  isValidPaymentId,
} from "../_shared/gopayBilling.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

/**
 * Update organization subscription after successful payment.
 */
async function updateOrgSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  orgId: string,
  tier: string,
  billingPeriod: string,
  seats: number,
  gopayPaymentId: string,
) {
  // Calculate expiration (1 month or 1 year from now)
  const expiresAt = new Date();
  if (billingPeriod === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      subscription_tier: tier,
      subscription_status: "active",
      max_seats: seats,
      billing_period: billingPeriod,
      billing_customer_id: gopayPaymentId,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org subscription:", error);
    throw error;
  }

  // Write billing history
  const amount = 0; // Amount from payment status will be used in production
  const { error: histError } = await supabase
    .from("org_billing_history")
    .insert({
      organization_id: orgId,
      amount,
      currency: "CZK",
      seats_count: seats,
      tier,
      gopay_payment_id: gopayPaymentId,
      status: "paid",
    });

  if (histError) {
    console.error("Failed to write org billing history:", histError);
  }

  // Write audit log
  const { error: auditError } = await supabase
    .from("subscription_audit_log")
    .insert({
      user_id: null,
      changed_by: null,
      old_tier: null,
      new_tier: tier,
      change_type: "gopay_org_webhook",
      notes: `orgId=${orgId}; seats=${seats}; billingPeriod=${billingPeriod}; gopayPaymentId=${gopayPaymentId}`,
    });

  if (auditError) {
    console.error("Failed to write subscription audit log:", auditError);
  }

  console.log(
    `Updated org subscription: orgId=${orgId}, tier=${tier}, seats=${seats}`,
  );
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = body.id ? String(body.id) : null;

    if (!isValidPaymentId(paymentId)) {
      return json(400, { error: "Invalid or missing payment ID" });
    }

    // Get payment status from GoPay
    const payment = await getPaymentStatus(paymentId);
    if (!payment) {
      return json(404, { error: "Payment not found" });
    }

    const state = payment.state;
    const orgId = getAdditionalParam(payment.additional_params, "orgId");

    // Only process org-level payments (those with orgId param)
    if (!orgId) {
      console.log(`Payment ${paymentId} is not an org payment, skipping`);
      return json(200, { received: true, processed: false, reason: "not_org_payment" });
    }

    const service = createServiceClient();

    // Deduplicate
    const eventId = `gopay-org-${paymentId}-${state}`;
    const { error: dedupError } = await service.from("billing_webhook_events").insert({
      event_id: eventId,
      event_type: state,
      status: "received",
      source: "gopay",
      payload_summary: { paymentId, state, orgId, source: "gopay_org" },
    });

    if (dedupError?.code === "23505") {
      return json(200, { received: true, processed: false, reason: "duplicate" });
    }

    if (state === "PAID") {
      const tier = getAdditionalParam(payment.additional_params, "tier") || "starter";
      const billingPeriod = getAdditionalParam(payment.additional_params, "billingPeriod") || "monthly";
      const seats = parseInt(getAdditionalParam(payment.additional_params, "seats") || "1", 10);

      await updateOrgSubscription(service, orgId, tier, billingPeriod, seats, paymentId);

      await service.from("billing_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);

      return json(200, { received: true, processed: true });
    }

    // Mark other states as ignored
    await service.from("billing_webhook_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return json(200, { received: true, processed: false, reason: `state_${state}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing GoPay org webhook:", message);
    return json(500, { error: message });
  }
});
