import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  type BillingPeriod,
  calculateExpiresAt,
  getAdditionalParam,
  getPaymentStatus,
  isValidPaymentId,
  shouldInitializeStartedAt,
} from "../_shared/gopayBilling.ts";

type SubscriptionStatus = "active" | "cancelled" | "expired";

interface ExistingProfile {
  subscription_tier: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

/**
 * Načte existující profil pro účely:
 *  - zachování `subscription_started_at` u recurring plateb (B1)
 *  - zaznamenání `old_tier` v audit logu (B5)
 *  - zachování `subscription_expires_at` při soft-cancel (N4)
 */
async function loadExistingProfile(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<ExistingProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("subscription_tier, subscription_started_at, subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load existing user_profile:", error);
    return null;
  }

  return (data ?? null) as ExistingProfile | null;
}

interface UpdateInput {
  userId: string;
  newTier: string;
  newStatus: SubscriptionStatus;
  newExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  gopayPaymentId: string;
  context: { eventId: string; eventType: string };
  /** Pokud true, zachovat existující expires_at z DB (soft-cancel scénář) */
  keepExistingExpires?: boolean;
}

async function updateUserSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  input: UpdateInput,
) {
  const existing = await loadExistingProfile(supabase, input.userId);

  // B1: zachovat původní subscription_started_at; nastavit jen pokud byl null a status=active
  const shouldSetStartedAt = shouldInitializeStartedAt(
    input.newStatus,
    existing?.subscription_started_at,
  );

  // N4: u CANCELED s zachovaným tier ponecháme existující expires_at
  const finalExpiresAt = input.keepExistingExpires
    ? existing?.subscription_expires_at ?? null
    : input.newExpiresAt
      ? input.newExpiresAt.toISOString()
      : null;

  const updateData: Record<string, unknown> = {
    stripe_subscription_tier: input.newTier,
    subscription_status: input.newStatus,
    subscription_cancel_at_period_end: input.cancelAtPeriodEnd,
    subscription_expires_at: finalExpiresAt,
    billing_subscription_id: input.gopayPaymentId,
    billing_provider: "gopay",
    updated_at: new Date().toISOString(),
  };

  if (shouldSetStartedAt) {
    updateData.subscription_started_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(updateData)
    .eq("user_id", input.userId);

  if (error) {
    console.error("Failed to update user subscription:", error);
    throw error;
  }

  // B5: audit log se starým a novým tier
  const oldTier = existing?.subscription_tier ?? null;
  const notes = [
    `eventType=${input.context.eventType}`,
    `gopayPaymentId=${input.context.eventId}`,
    `status=${input.newStatus}`,
    `tier=${input.newTier}`,
    `cancelAtPeriodEnd=${input.cancelAtPeriodEnd}`,
  ].join("; ");

  const { error: auditError } = await supabase
    .from("subscription_audit_log")
    .insert({
      user_id: input.userId,
      changed_by: null,
      old_tier: oldTier,
      new_tier: input.newTier,
      change_type: "gopay_webhook",
      notes,
    });

  if (auditError) {
    console.error("Failed to write subscription audit log:", auditError);
  }

  console.log(
    `Updated subscription for user ${input.userId}: ${oldTier ?? "?"} → ${input.newTier}, status=${input.newStatus}, cancelAtPeriodEnd=${input.cancelAtPeriodEnd}`,
  );
}

const registerWebhookEvent = async (
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string,
  eventType: string,
): Promise<{ duplicate: boolean }> => {
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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // GoPay posílá HTTP GET s ?id={paymentId}
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("id");

  // B4: validace paymentId jako numerický string (max 20 cifer = bezpečně pokrývá int64)
  if (!isValidPaymentId(paymentId)) {
    return json(400, { error: "Invalid or missing payment ID" });
  }

  const supabase = createServiceClient();

  try {
    // CRITICAL: Verifikace platby přes GoPay API (notifikace neobsahuje žádné údaje kromě ID)
    const payment = await getPaymentStatus(paymentId);
    const state = payment.state;

    console.log(
      `GoPay webhook: paymentId=${paymentId}, state=${state}, parent_id=${payment.parent_id ?? "none"}`,
    );

    const registration = await registerWebhookEvent(supabase, paymentId, state);
    if (registration.duplicate) {
      return json(200, { received: true, duplicate: true, state });
    }

    const userId = getAdditionalParam(payment.additional_params, "userId");
    const tier = getAdditionalParam(payment.additional_params, "tier") || "starter";
    const billingPeriod: BillingPeriod =
      (getAdditionalParam(payment.additional_params, "billingPeriod") as BillingPeriod) || "monthly";
    const isRecurring = Boolean(payment.parent_id);

    let processStatus: "processed" | "ignored" = "processed";

    switch (state) {
      case "PAID": {
        let resolvedUserId = userId;

        if (!resolvedUserId && payment.parent_id) {
          // Recurring charge — najdi uživatele podle parent payment ID
          resolvedUserId =
            (await resolveUserByPaymentId(supabase, String(payment.parent_id))) ?? undefined;
        }

        if (!resolvedUserId) {
          console.error("No userId found for PAID payment:", paymentId);
          processStatus = "ignored";
          break;
        }

        const expiresAt = calculateExpiresAt(billingPeriod);

        await updateUserSubscription(supabase, {
          userId: resolvedUserId,
          newTier: tier,
          newStatus: "active",
          newExpiresAt: expiresAt,
          cancelAtPeriodEnd: false,
          // U recurring chargů ukládáme parent_id jako referenci subscription
          gopayPaymentId: String(payment.parent_id || paymentId),
          context: {
            eventId: paymentId,
            eventType: `PAID${isRecurring ? "_RECURRENCE" : "_INITIAL"}`,
          },
        });
        break;
      }

      case "CANCELED": {
        // GoPay CANCELED = platba zamítnuta (3DS reject, bank decline, timeout).
        // - Initial (no parent_id): subscription nikdy nezačal → ignore.
        // - Recurring (s parent_id): současné období dohraje, ale nepokračovat.
        if (!isRecurring) {
          console.log(
            `Initial payment ${paymentId} CANCELED — subscription nezačal, ignoruji.`,
          );
          processStatus = "ignored";
          break;
        }

        let resolvedUserId = userId;
        if (!resolvedUserId && payment.parent_id) {
          resolvedUserId =
            (await resolveUserByPaymentId(supabase, String(payment.parent_id))) ?? undefined;
        }

        if (!resolvedUserId) {
          console.error("No userId found for recurring CANCELED payment:", paymentId);
          processStatus = "ignored";
          break;
        }

        // Soft-cancel: zachovat tier i expires_at (uživatel doplatil období),
        // jen označit, že příští recurring se nestrhne.
        await updateUserSubscription(supabase, {
          userId: resolvedUserId,
          newTier: tier,
          newStatus: "cancelled",
          newExpiresAt: null, // ignorováno díky keepExistingExpires
          cancelAtPeriodEnd: true,
          keepExistingExpires: true,
          gopayPaymentId: String(payment.parent_id ?? paymentId),
          context: { eventId: paymentId, eventType: "CANCELED_RECURRENCE" },
        });
        break;
      }

      case "REFUNDED": {
        // Peníze vráceny — subscription končí ihned, tier=free.
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

        await updateUserSubscription(supabase, {
          userId: resolvedUserId,
          newTier: "free",
          newStatus: "expired",
          newExpiresAt: null,
          cancelAtPeriodEnd: false,
          gopayPaymentId: paymentId,
          context: { eventId: paymentId, eventType: "REFUNDED" },
        });
        break;
      }

      case "PARTIALLY_REFUNDED": {
        // Částečné vrácení — neměníme stav subscription, jen logujeme do audit logu.
        // Plná business logika (např. pro-rata) je nad rámec aktuální implementace.
        console.log(`Payment ${paymentId} PARTIALLY_REFUNDED — žádná akce, jen audit.`);
        processStatus = "ignored";
        break;
      }

      case "CREATED":
      case "PAYMENT_METHOD_CHOSEN":
      case "AUTHORIZED":
        // Tyto stavy jsou před-finální, aktualizace neproběhne.
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
