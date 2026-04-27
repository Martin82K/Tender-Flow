/**
 * Stripe webhook handler (user-level subscription events).
 *
 * Bezpečnost:
 *   - HMAC SHA-256 verifikace přes `Stripe-Signature` header (`STRIPE_WEBHOOK_SECRET`).
 *   - Idempotence přes `billing_webhook_events.event_id = "stripe-<evt_…>"` (UNIQUE constraint).
 *   - Org-level eventy (s `metadata.orgId`) se ignorují — patří do `stripe-org-webhook`
 *     (samostatný endpoint, samostatný secret).
 *
 * Zpracovávané eventy:
 *   - checkout.session.completed       → uložit customer/subscription ID, set tier=metadata.tier, status=active
 *   - customer.subscription.updated    → sync expires_at, cancel_at_period_end, status, tier
 *   - customer.subscription.deleted    → status=expired, tier=free
 *   - invoice.payment_succeeded        → renewal: refresh expires_at z subscription
 *   - invoice.payment_failed           → status=pending (mapping ze Stripe past_due)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  type StripeSubscription,
  type Tier,
  mapStripeSubscriptionStatusToInternal,
  parseStripeMetadata,
  retrieveSubscription,
  stripePeriodEndToDate,
  validateStripeId,
  verifyStripeWebhookSignature,
} from "../_shared/stripeBilling.ts";

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

interface CheckoutSessionEventObject {
  id: string;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_status: string | null;
}

interface InvoiceEventObject {
  id: string;
  customer: string | null;
  subscription: string | null;
  status: string | null;
}

const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

interface ExistingProfile {
  user_id: string;
  subscription_tier: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
}

const loadProfileByUserId = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ExistingProfile | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, subscription_tier, subscription_started_at, subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load user_profile by user_id:", error);
    return null;
  }
  return (data ?? null) as ExistingProfile | null;
};

const resolveUserIdByCustomer = async (
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("billing_customer_id", customerId)
    .eq("billing_provider", "stripe")
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve user by customer ID:", error);
    return null;
  }
  return (data?.user_id as string | undefined) ?? null;
};

const resolveUserIdBySubscription = async (
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("billing_subscription_id", subscriptionId)
    .eq("billing_provider", "stripe")
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve user by subscription ID:", error);
    return null;
  }
  return (data?.user_id as string | undefined) ?? null;
};

const resolveUserId = async (
  supabase: SupabaseClient,
  metadataUserId: string | undefined,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<string | null> => {
  if (metadataUserId) return metadataUserId;
  if (subscriptionId && validateStripeId(subscriptionId, "subscription")) {
    const byId = await resolveUserIdBySubscription(supabase, subscriptionId);
    if (byId) return byId;
  }
  if (customerId && validateStripeId(customerId, "customer")) {
    return await resolveUserIdByCustomer(supabase, customerId);
  }
  return null;
};

const registerStripeWebhookEvent = async (
  supabase: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<{ duplicate: boolean }> => {
  const { error } = await supabase.from("billing_webhook_events").insert({
    event_id: `stripe-${eventId}`,
    event_type: eventType,
    status: "received",
    source: "stripe",
    payload_summary: {
      eventId,
      eventType,
      receivedAt: new Date().toISOString(),
    },
  });

  if (error) {
    if (error.code === "23505") return { duplicate: true };
    throw error;
  }
  return { duplicate: false };
};

const markStripeWebhookStatus = async (
  supabase: SupabaseClient,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  note?: string,
) => {
  const { error } = await supabase
    .from("billing_webhook_events")
    .update({
      status,
      error_message: note ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", `stripe-${eventId}`);

  if (error) console.error("Failed to update webhook status:", error);
};

interface ApplyUpdateInput {
  userId: string;
  newTier: string;
  newStatus: "active" | "trial" | "cancelled" | "expired" | "pending";
  newExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  context: { eventId: string; eventType: string };
  /** Pokud true, zachovat existující expires_at z DB (nezdařené invoice atd.). */
  keepExistingExpires?: boolean;
}

const applyUserSubscriptionUpdate = async (
  supabase: SupabaseClient,
  input: ApplyUpdateInput,
) => {
  const existing = await loadProfileByUserId(supabase, input.userId);

  // Zachovat původní subscription_started_at; nastavit jen pokud chybí a status=active
  const shouldSetStartedAt =
    input.newStatus === "active" && !existing?.subscription_started_at;

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
    billing_provider: "stripe",
    updated_at: new Date().toISOString(),
  };

  if (input.subscriptionId) updateData.billing_subscription_id = input.subscriptionId;
  if (input.customerId) updateData.billing_customer_id = input.customerId;
  if (shouldSetStartedAt) updateData.subscription_started_at = new Date().toISOString();

  const { error } = await supabase
    .from("user_profiles")
    .update(updateData)
    .eq("user_id", input.userId);

  if (error) {
    console.error("Failed to update user_profiles from Stripe webhook:", error);
    throw error;
  }

  const oldTier = existing?.subscription_tier ?? null;
  const notes = [
    `eventType=${input.context.eventType}`,
    `eventId=${input.context.eventId}`,
    `status=${input.newStatus}`,
    `tier=${input.newTier}`,
    `cancelAtPeriodEnd=${input.cancelAtPeriodEnd}`,
    input.subscriptionId ? `subscriptionId=${input.subscriptionId}` : null,
    input.customerId ? `customerId=${input.customerId}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const { error: auditError } = await supabase
    .from("subscription_audit_log")
    .insert({
      user_id: input.userId,
      changed_by: null,
      old_tier: oldTier,
      new_tier: input.newTier,
      change_type: "stripe_webhook",
      notes,
    });

  if (auditError) {
    console.error("Failed to write subscription_audit_log:", auditError);
  }

  console.log(
    `Stripe webhook applied: user=${input.userId}, ${oldTier ?? "?"} → ${input.newTier}, status=${input.newStatus}, cancelAtPeriodEnd=${input.cancelAtPeriodEnd}`,
  );
};

interface EventResult {
  status: "processed" | "ignored";
  note?: string;
}

const isOrgEvent = (metadata: Record<string, string> | null | undefined): boolean => {
  if (!metadata) return false;
  return typeof metadata.orgId === "string" && metadata.orgId.length > 0;
};

const fetchSubscriptionForEvent = async (
  subscriptionId: string,
): Promise<StripeSubscription | null> => {
  if (!validateStripeId(subscriptionId, "subscription")) return null;
  try {
    return await retrieveSubscription(subscriptionId);
  } catch (err) {
    console.error("Failed to retrieve Stripe subscription:", err);
    return null;
  }
};

const tierFromSubscription = (
  sub: StripeSubscription | null,
  fallback: string | null,
): string => {
  const meta = parseStripeMetadata(sub?.metadata ?? null);
  if (meta.tier) return meta.tier;
  return fallback ?? "starter";
};

const handleCheckoutCompleted = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const session = event.data.object as CheckoutSessionEventObject;
  const meta = parseStripeMetadata(session.metadata ?? null);

  if (isOrgEvent(session.metadata)) {
    return { status: "ignored", note: "Org-level event — patří do stripe-org-webhook" };
  }

  const userId =
    meta.userId ?? (typeof session.client_reference_id === "string" ? session.client_reference_id : undefined);

  if (!userId) {
    return { status: "ignored", note: "checkout.session.completed bez userId" };
  }

  const subscriptionId = session.subscription;
  if (!subscriptionId || !validateStripeId(subscriptionId, "subscription")) {
    return { status: "ignored", note: "Chybí nebo nevalidní subscription ID" };
  }

  const subscription = await fetchSubscriptionForEvent(subscriptionId);
  if (!subscription) {
    return { status: "ignored", note: "Nelze získat subscription detail" };
  }

  const tier = tierFromSubscription(subscription, meta.tier ?? null) as Tier;
  const expiresAt = stripePeriodEndToDate(subscription.current_period_end);
  const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);

  await applyUserSubscriptionUpdate(supabase, {
    userId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    customerId: session.customer ?? subscription.customer ?? null,
    subscriptionId: subscription.id,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const handleSubscriptionUpdated = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const subscription = event.data.object as unknown as StripeSubscription;
  const meta = parseStripeMetadata(subscription.metadata ?? null);

  if (isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "Org-level event" };
  }

  const userId = await resolveUserId(
    supabase,
    meta.userId,
    subscription.id,
    subscription.customer ?? null,
  );

  if (!userId) {
    return { status: "ignored", note: "Nelze najít userId" };
  }

  const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);
  const tier =
    internalStatus === "expired"
      ? "free"
      : tierFromSubscription(subscription, null);
  const expiresAt =
    internalStatus === "expired" ? null : stripePeriodEndToDate(subscription.current_period_end);

  await applyUserSubscriptionUpdate(supabase, {
    userId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const handleSubscriptionDeleted = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const subscription = event.data.object as unknown as StripeSubscription;

  if (isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "Org-level event" };
  }

  const meta = parseStripeMetadata(subscription.metadata ?? null);
  const userId = await resolveUserId(
    supabase,
    meta.userId,
    subscription.id,
    subscription.customer ?? null,
  );

  if (!userId) {
    return { status: "ignored", note: "Nelze najít userId" };
  }

  await applyUserSubscriptionUpdate(supabase, {
    userId,
    newTier: "free",
    newStatus: "expired",
    newExpiresAt: null,
    cancelAtPeriodEnd: false,
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const handleInvoicePaymentSucceeded = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const invoice = event.data.object as InvoiceEventObject;
  const subscriptionId = invoice.subscription;
  if (!subscriptionId || !validateStripeId(subscriptionId, "subscription")) {
    return { status: "ignored", note: "Invoice bez subscription ID" };
  }

  const subscription = await fetchSubscriptionForEvent(subscriptionId);
  if (!subscription) {
    return { status: "ignored", note: "Nelze získat subscription detail" };
  }

  if (isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "Org-level event" };
  }

  const meta = parseStripeMetadata(subscription.metadata ?? null);
  const userId = await resolveUserId(
    supabase,
    meta.userId,
    subscription.id,
    subscription.customer ?? null,
  );

  if (!userId) {
    return { status: "ignored", note: "Nelze najít userId" };
  }

  const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);
  const tier =
    internalStatus === "expired" ? "free" : tierFromSubscription(subscription, null);
  const expiresAt = stripePeriodEndToDate(subscription.current_period_end);

  await applyUserSubscriptionUpdate(supabase, {
    userId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const handleInvoicePaymentFailed = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const invoice = event.data.object as InvoiceEventObject;
  const subscriptionId = invoice.subscription;
  if (!subscriptionId || !validateStripeId(subscriptionId, "subscription")) {
    return { status: "ignored", note: "Invoice bez subscription ID" };
  }

  const subscription = await fetchSubscriptionForEvent(subscriptionId);
  // Pokud Stripe API selže, fall back na minimální update pomocí jen subscription ID z DB
  const customerIdFromInvoice = invoice.customer ?? null;

  const meta = subscription ? parseStripeMetadata(subscription.metadata ?? null) : {};
  if (subscription && isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "Org-level event" };
  }

  const userId = await resolveUserId(
    supabase,
    meta.userId,
    subscriptionId,
    subscription?.customer ?? customerIdFromInvoice,
  );

  if (!userId) {
    return { status: "ignored", note: "Nelze najít userId" };
  }

  const internalStatus = subscription
    ? mapStripeSubscriptionStatusToInternal(subscription.status)
    : "pending";
  const tier = subscription ? tierFromSubscription(subscription, null) : "starter";

  await applyUserSubscriptionUpdate(supabase, {
    userId,
    newTier: tier,
    newStatus: internalStatus === "active" ? "pending" : internalStatus,
    newExpiresAt: null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    customerId: subscription?.customer ?? customerIdFromInvoice,
    subscriptionId,
    keepExistingExpires: true,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const processStripeEvent = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  switch (event.type) {
    case "checkout.session.completed":
      return await handleCheckoutCompleted(supabase, event);
    case "customer.subscription.updated":
      return await handleSubscriptionUpdated(supabase, event);
    case "customer.subscription.deleted":
      return await handleSubscriptionDeleted(supabase, event);
    case "invoice.payment_succeeded":
      return await handleInvoicePaymentSucceeded(supabase, event);
    case "invoice.payment_failed":
      return await handleInvoicePaymentFailed(supabase, event);
    default:
      return { status: "ignored", note: `Unsupported event: ${event.type}` };
  }
};

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

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return json(500, { error: "Webhook secret not configured" });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("Stripe-Signature");

  const verification = await verifyStripeWebhookSignature(rawBody, signatureHeader, secret);
  if (!verification.valid) {
    console.warn("Stripe webhook signature invalid:", verification.reason);
    return json(401, { error: "Invalid signature" });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!event.id || !validateStripeId(event.id, "event") || !event.type) {
    return json(400, { error: "Malformed event" });
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    return json(200, { received: true, ignored: true, type: event.type });
  }

  const supabase = createServiceClient();

  try {
    const registration = await registerStripeWebhookEvent(supabase, event.id, event.type);
    if (registration.duplicate) {
      return json(200, { received: true, duplicate: true, type: event.type });
    }

    const result = await processStripeEvent(supabase, event);
    await markStripeWebhookStatus(supabase, event.id, result.status, result.note);
    return json(200, {
      received: true,
      type: event.type,
      status: result.status,
      ...(result.note ? { note: result.note } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Stripe webhook:", message);
    try {
      await markStripeWebhookStatus(supabase, event.id, "failed", message);
    } catch {
      // best-effort
    }
    return json(500, { error: message });
  }
});
