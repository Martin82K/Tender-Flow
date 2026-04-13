import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  getAdditionalParam,
  getPaymentStatus,
} from "../_shared/gopayBilling.ts";

type SubscriptionStatus = "active" | "cancelled" | "expired";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

async function updateUserSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  tier: string,
  status: SubscriptionStatus,
  expiresAt: Date | null,
  gopayPaymentId: string,
  context: { eventId: string; eventType: string },
) {
  const updateData: Record<string, unknown> = {
    stripe_subscription_tier: tier,
    subscription_status: status,
    subscription_cancel_at_period_end: status === "cancelled",
    subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
    billing_subscription_id: gopayPaymentId,
    billing_provider: "gopay",
    updated_at: new Date().toISOString(),
  };

  if (status === "active" && !updateData.subscription_started_at) {
    updateData.subscription_started_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update user subscription:", error);
    throw error;
  }

  const notes = [
    `eventType=${context.eventType}`,
    `gopayPaymentId=${context.eventId}`,
    `status=${status}`,
    `tier=${tier}`,
  ].join("; ");

  const { error: auditError } = await supabase
    .from("subscription_audit_log")
    .insert({
      user_id: userId,
      changed_by: null,
      old_tier: null,
      new_tier: tier,
      change_type: "gopay_webhook",
      notes,
    });

  if (auditError) {
    console.error("Failed to write subscription audit log:", auditError);
  }

  console.log(
    `Updated subscription for user ${userId}: tier=${tier}, status=${status}`,
  );
}

const registerWebhookEvent = async (
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string,
  eventType: string,
): Promise<{ duplicate: boolean }> => {
  // Use paymentId + state as unique event_id to handle multiple state changes
  const eventId = `gopay-${paymentId}-${eventType}`;
  const payloadSummary = {
    paymentId,
    state: eventType,
    source: "gopay",
    receivedAt: new Date().toISOString(),
  };

  const { error } = await supabase.from("billing_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    status: "received",
    source: "gopay",
    payload_summary: payloadSummary,
  });

  if (error) {
    if (error.code === "23505") {
      return { duplicate: true };
    }
    throw error;
  }

  return { duplicate: false };
};

const markWebhookStatus = async (
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string,
  eventType: string,
  status: "processed" | "ignored" | "failed",
  errorMessage?: string,
) => {
  const eventId = `gopay-${paymentId}-${eventType}`;
  const { error } = await supabase
    .from("billing_webhook_events")
    .update({
      status,
      error_message: errorMessage ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  if (error) {
    console.error("Failed to update webhook status:", error);
  }
};

const resolveUserByPaymentId = async (
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("billing_subscription_id", paymentId)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve user by payment ID:", error);
    return null;
  }

  return data?.user_id || null;
};

function calculateExpiresAt(billingPeriod: string): Date {
  const now = new Date();
  if (billingPeriod === "yearly") {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // GoPay sends webhook as HTTP GET with ?id={paymentId}
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("id");

  if (!paymentId) {
    return json(400, { error: "Missing payment ID" });
  }

  const supabase = createServiceClient();

  try {
    // CRITICAL: Verify payment by querying GoPay API (no signature verification)
    const payment = await getPaymentStatus(paymentId);
    const state = payment.state;

    console.log(
      `GoPay webhook: paymentId=${paymentId}, state=${state}, parent_id=${payment.parent_id ?? "none"}`,
    );

    // Register for idempotency
    const registration = await registerWebhookEvent(
      supabase,
      paymentId,
      state,
    );
    if (registration.duplicate) {
      return json(200, { received: true, duplicate: true, state });
    }

    // Extract user info from additional_params
    const userId = getAdditionalParam(payment.additional_params, "userId");
    const tier = getAdditionalParam(payment.additional_params, "tier") || "starter";
    const billingPeriod: BillingPeriod =
      (getAdditionalParam(payment.additional_params, "billingPeriod") as BillingPeriod) || "monthly";

    let processStatus: "processed" | "ignored" = "processed";

    switch (state) {
      case "PAID": {
        // Resolve user: from additional_params or by parent payment ID lookup
        let resolvedUserId = userId;

        if (!resolvedUserId && payment.parent_id) {
          // This is a recurring charge — find user by parent payment ID
          resolvedUserId =
            (await resolveUserByPaymentId(supabase, String(payment.parent_id))) ?? undefined;
        }

        if (!resolvedUserId) {
          console.error("No userId found for PAID payment:", paymentId);
          processStatus = "ignored";
          break;
        }

        const expiresAt = calculateExpiresAt(billingPeriod);

        await updateUserSubscription(
          supabase,
          resolvedUserId,
          tier,
          "active",
          expiresAt,
          // For recurring payments, store the parent payment ID as the subscription reference
          String(payment.parent_id || paymentId),
          {
            eventId: paymentId,
            eventType: `PAID${payment.parent_id ? "_RECURRENCE" : "_INITIAL"}`,
          },
        );
        break;
      }

      case "CANCELED": {
        let resolvedUserId = userId;
        if (!resolvedUserId) {
          resolvedUserId =
            (await resolveUserByPaymentId(supabase, paymentId)) ??
            (payment.parent_id
              ? (await resolveUserByPaymentId(supabase, String(payment.parent_id))) ?? undefined
              : undefined);
        }

        if (!resolvedUserId) {
          console.error("No userId found for CANCELED payment:", paymentId);
          processStatus = "ignored";
          break;
        }

        await updateUserSubscription(
          supabase,
          resolvedUserId,
          "free",
          "expired",
          null,
          paymentId,
          { eventId: paymentId, eventType: "CANCELED" },
        );
        break;
      }

      case "REFUNDED": {
        let resolvedUserId = userId;
        if (!resolvedUserId) {
          resolvedUserId =
            (await resolveUserByPaymentId(supabase, paymentId)) ??
            (payment.parent_id
              ? (await resolveUserByPaymentId(supabase, String(payment.parent_id))) ?? undefined
              : undefined);
        }

        if (!resolvedUserId) {
          console.error("No userId found for REFUNDED payment:", paymentId);
          processStatus = "ignored";
          break;
        }

        await updateUserSubscription(
          supabase,
          resolvedUserId,
          "free",
          "expired",
          null,
          paymentId,
          { eventId: paymentId, eventType: "REFUNDED" },
        );
        break;
      }

      case "CREATED":
      case "PAYMENT_METHOD_CHOSEN":
      case "AUTHORIZED":
        // These states don't require action
        processStatus = "ignored";
        break;

      default:
        console.log(`Unhandled GoPay payment state: ${state}`);
        processStatus = "ignored";
    }

    await markWebhookStatus(supabase, paymentId, state, processStatus);
    return json(200, { received: true, state, status: processStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing GoPay webhook:", message);

    try {
      await markWebhookStatus(supabase, paymentId, "UNKNOWN", "failed", message);
    } catch {
      // Best effort
    }

    return json(500, { error: message });
  }
});
