/**
 * Stripe webhook handler (org-level subscription events).
 *
 * Bezpečnost:
 *   - HMAC SHA-256 verifikace přes `Stripe-Signature` header (`STRIPE_ORG_WEBHOOK_SECRET`).
 *     Samostatný secret = samostatný endpoint v Stripe Dashboardu (oddělená rotace klíčů
 *     a izolace průniku).
 *   - Idempotence přes `billing_webhook_events.event_id = "stripe-org-<evt_…>"`
 *     (UNIQUE constraint, prefix odlišný od user webhooku → žádná kolize).
 *   - User-level eventy (bez `metadata.orgId`) se ignorují — patří do `stripe-webhook`.
 *
 * Zpracovávané eventy (stejné jako user webhook, jiná cílová tabulka):
 *   - checkout.session.completed       → uložit customer/subscription ID na organizations,
 *                                         set tier=metadata.tier, status=active, max_seats=quantity
 *   - customer.subscription.updated    → sync expires_at, status, tier, max_seats (z items[].quantity)
 *   - customer.subscription.deleted    → status=expired, tier=free
 *   - invoice.payment_succeeded        → renewal: refresh expires_at + zápis do org_billing_history
 *   - invoice.payment_failed           → status=pending (mapping ze Stripe past_due)
 *
 * Schéma poznámka: `org_billing_history.gopay_payment_id` je legacy název — pro Stripe
 * tam ukládáme `subscription_id` (totéž rozhraní co GoPay payment ID, jen nový provider).
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
  amount_total: number | null;
  currency: string | null;
}

interface InvoiceEventObject {
  id: string;
  customer: string | null;
  subscription: string | null;
  status: string | null;
  amount_paid: number | null;
  currency: string | null;
}

const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

interface ExistingOrg {
  id: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  expires_at: string | null;
  max_seats: number | null;
  billing_period: string | null;
}

const loadOrgById = async (
  supabase: SupabaseClient,
  orgId: string,
): Promise<ExistingOrg | null> => {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, subscription_tier, subscription_status, expires_at, max_seats, billing_period",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load organization:", error);
    return null;
  }
  return (data ?? null) as ExistingOrg | null;
};

const resolveOrgIdByCustomer = async (
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | null> => {
  // Org doesn't have `billing_provider` column — match jen přes customer_id (Stripe prefix
  // garantuje, že to není GoPay payment ID, které má číselný ID).
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("billing_customer_id", customerId)
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve org by customer ID:", error);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
};

const resolveOrgId = async (
  supabase: SupabaseClient,
  metadataOrgId: string | undefined,
  customerId: string | null,
): Promise<string | null> => {
  if (metadataOrgId) return metadataOrgId;
  if (customerId && validateStripeId(customerId, "customer")) {
    return await resolveOrgIdByCustomer(supabase, customerId);
  }
  return null;
};

const registerStripeOrgWebhookEvent = async (
  supabase: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<{ duplicate: boolean }> => {
  const { error } = await supabase.from("billing_webhook_events").insert({
    event_id: `stripe-org-${eventId}`,
    event_type: eventType,
    status: "received",
    source: "stripe",
    payload_summary: {
      eventId,
      eventType,
      scope: "org",
      receivedAt: new Date().toISOString(),
    },
  });

  if (error) {
    if (error.code === "23505") return { duplicate: true };
    throw error;
  }
  return { duplicate: false };
};

const markStripeOrgWebhookStatus = async (
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
    .eq("event_id", `stripe-org-${eventId}`);

  if (error) console.error("Failed to update org webhook status:", error);
};

interface ApplyOrgUpdateInput {
  orgId: string;
  newTier: string;
  newStatus: "active" | "trial" | "cancelled" | "expired" | "pending";
  newExpiresAt: Date | null;
  customerId: string | null;
  subscriptionId: string | null;
  seats: number | null;
  billingPeriod: "monthly" | "yearly" | null;
  context: { eventId: string; eventType: string };
  /** Pokud true, zachovat existující expires_at z DB (failed invoice apod.). */
  keepExistingExpires?: boolean;
}

const applyOrgSubscriptionUpdate = async (
  supabase: SupabaseClient,
  input: ApplyOrgUpdateInput,
) => {
  const existing = await loadOrgById(supabase, input.orgId);
  if (!existing) {
    throw new Error(`Organization not found: ${input.orgId}`);
  }

  const finalExpiresAt = input.keepExistingExpires
    ? existing.expires_at ?? null
    : input.newExpiresAt
      ? input.newExpiresAt.toISOString()
      : null;

  const updateData: Record<string, unknown> = {
    subscription_tier: input.newTier,
    subscription_status: input.newStatus,
    expires_at: finalExpiresAt,
    updated_at: new Date().toISOString(),
  };

  if (input.customerId) updateData.billing_customer_id = input.customerId;
  if (input.seats !== null && input.seats > 0) updateData.max_seats = input.seats;
  if (input.billingPeriod) updateData.billing_period = input.billingPeriod;

  const { error } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", input.orgId);

  if (error) {
    console.error("Failed to update organizations from Stripe org webhook:", error);
    throw error;
  }

  const oldTier = existing.subscription_tier ?? null;
  const notes = [
    `eventType=${input.context.eventType}`,
    `eventId=${input.context.eventId}`,
    `orgId=${input.orgId}`,
    `status=${input.newStatus}`,
    `tier=${input.newTier}`,
    input.seats !== null ? `seats=${input.seats}` : null,
    input.billingPeriod ? `billingPeriod=${input.billingPeriod}` : null,
    input.subscriptionId ? `subscriptionId=${input.subscriptionId}` : null,
    input.customerId ? `customerId=${input.customerId}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const { error: auditError } = await supabase
    .from("subscription_audit_log")
    .insert({
      user_id: null,
      changed_by: null,
      old_tier: oldTier,
      new_tier: input.newTier,
      change_type: "stripe_org_webhook",
      notes,
    });

  if (auditError) {
    console.error("Failed to write subscription_audit_log (org):", auditError);
  }

  console.log(
    `Stripe org webhook applied: org=${input.orgId}, ${oldTier ?? "?"} → ${input.newTier}, status=${input.newStatus}`,
  );
};

const writeOrgBillingHistory = async (
  supabase: SupabaseClient,
  params: {
    orgId: string;
    amountMinor: number;
    currency: string;
    seats: number | null;
    tier: string;
    subscriptionId: string;
    status: "paid" | "failed";
  },
) => {
  // `gopay_payment_id` je legacy název sloupce — ukládáme tam Stripe subscription_id
  // (stejné účel: identifikace platby v audit historii).
  const { error } = await supabase.from("org_billing_history").insert({
    organization_id: params.orgId,
    amount: params.amountMinor,
    currency: params.currency.toUpperCase(),
    seats_count: params.seats,
    tier: params.tier,
    gopay_payment_id: params.subscriptionId,
    status: params.status,
  });

  if (error) {
    console.error("Failed to write org_billing_history:", error);
  }
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
    console.error("Failed to retrieve Stripe subscription (org):", err);
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

const seatsFromSubscription = (
  sub: StripeSubscription | null,
  fallbackFromMeta: number | null,
): number | null => {
  const item = sub?.items?.data?.[0];
  if (item && typeof item.quantity === "number" && item.quantity > 0) {
    return item.quantity;
  }
  return fallbackFromMeta;
};

const billingPeriodFromSubscription = (
  sub: StripeSubscription | null,
  fallback: "monthly" | "yearly" | null,
): "monthly" | "yearly" | null => {
  const recurring = sub?.items?.data?.[0]?.price?.recurring;
  if (recurring?.interval === "year") return "yearly";
  if (recurring?.interval === "month") return "monthly";
  return fallback;
};

const handleCheckoutCompleted = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const session = event.data.object as CheckoutSessionEventObject;

  if (!isOrgEvent(session.metadata)) {
    return { status: "ignored", note: "User-level event — patří do stripe-webhook" };
  }

  const meta = parseStripeMetadata(session.metadata ?? null);
  const orgId = meta.orgId ?? (typeof session.client_reference_id === "string" ? session.client_reference_id : undefined);

  if (!orgId) {
    return { status: "ignored", note: "checkout.session.completed bez orgId" };
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
  const seats = seatsFromSubscription(subscription, meta.seats ?? null);
  const billingPeriod = billingPeriodFromSubscription(
    subscription,
    meta.billingPeriod ?? null,
  );

  await applyOrgSubscriptionUpdate(supabase, {
    orgId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    customerId: session.customer ?? subscription.customer ?? null,
    subscriptionId: subscription.id,
    seats,
    billingPeriod,
    context: { eventId: event.id, eventType: event.type },
  });

  if (internalStatus === "active" || internalStatus === "trial") {
    await writeOrgBillingHistory(supabase, {
      orgId,
      amountMinor: typeof session.amount_total === "number" ? session.amount_total : 0,
      currency: session.currency ?? "CZK",
      seats,
      tier,
      subscriptionId: subscription.id,
      status: "paid",
    });
  }

  return { status: "processed" };
};

const handleSubscriptionUpdated = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const subscription = event.data.object as unknown as StripeSubscription;

  if (!isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "User-level event" };
  }

  const meta = parseStripeMetadata(subscription.metadata ?? null);
  const orgId = await resolveOrgId(supabase, meta.orgId, subscription.customer ?? null);
  if (!orgId) {
    return { status: "ignored", note: "Nelze najít orgId" };
  }

  const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);
  const tier =
    internalStatus === "expired"
      ? "free"
      : tierFromSubscription(subscription, null);
  const expiresAt =
    internalStatus === "expired"
      ? null
      : stripePeriodEndToDate(subscription.current_period_end);
  const seats =
    internalStatus === "expired"
      ? null
      : seatsFromSubscription(subscription, meta.seats ?? null);
  const billingPeriod = billingPeriodFromSubscription(
    subscription,
    meta.billingPeriod ?? null,
  );

  await applyOrgSubscriptionUpdate(supabase, {
    orgId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    seats,
    billingPeriod,
    context: { eventId: event.id, eventType: event.type },
  });

  return { status: "processed" };
};

const handleSubscriptionDeleted = async (
  supabase: SupabaseClient,
  event: StripeEvent,
): Promise<EventResult> => {
  const subscription = event.data.object as unknown as StripeSubscription;

  if (!isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "User-level event" };
  }

  const meta = parseStripeMetadata(subscription.metadata ?? null);
  const orgId = await resolveOrgId(supabase, meta.orgId, subscription.customer ?? null);
  if (!orgId) {
    return { status: "ignored", note: "Nelze najít orgId" };
  }

  await applyOrgSubscriptionUpdate(supabase, {
    orgId,
    newTier: "free",
    newStatus: "expired",
    newExpiresAt: null,
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    seats: null,
    billingPeriod: null,
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

  if (!isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "User-level event" };
  }

  const meta = parseStripeMetadata(subscription.metadata ?? null);
  const orgId = await resolveOrgId(supabase, meta.orgId, subscription.customer ?? null);
  if (!orgId) {
    return { status: "ignored", note: "Nelze najít orgId" };
  }

  const internalStatus = mapStripeSubscriptionStatusToInternal(subscription.status);
  const tier =
    internalStatus === "expired" ? "free" : tierFromSubscription(subscription, null);
  const expiresAt = stripePeriodEndToDate(subscription.current_period_end);
  const seats = seatsFromSubscription(subscription, meta.seats ?? null);
  const billingPeriod = billingPeriodFromSubscription(
    subscription,
    meta.billingPeriod ?? null,
  );

  await applyOrgSubscriptionUpdate(supabase, {
    orgId,
    newTier: tier,
    newStatus: internalStatus,
    newExpiresAt: expiresAt,
    customerId: subscription.customer ?? null,
    subscriptionId: subscription.id,
    seats,
    billingPeriod,
    context: { eventId: event.id, eventType: event.type },
  });

  // Invoice renewal → zápis do org_billing_history (renewal event).
  if (internalStatus === "active" || internalStatus === "trial") {
    await writeOrgBillingHistory(supabase, {
      orgId,
      amountMinor: typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0,
      currency: invoice.currency ?? "CZK",
      seats,
      tier,
      subscriptionId: subscription.id,
      status: "paid",
    });
  }

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
  const customerIdFromInvoice = invoice.customer ?? null;

  const meta = subscription ? parseStripeMetadata(subscription.metadata ?? null) : {};
  if (subscription && !isOrgEvent(subscription.metadata)) {
    return { status: "ignored", note: "User-level event" };
  }
  // Pokud subscription nelze načíst, fallback: spolehni se na meta + customer lookup.
  if (!subscription && !meta.orgId) {
    return { status: "ignored", note: "Nelze získat subscription detail ani orgId" };
  }

  const orgId = await resolveOrgId(
    supabase,
    meta.orgId,
    subscription?.customer ?? customerIdFromInvoice,
  );
  if (!orgId) {
    return { status: "ignored", note: "Nelze najít orgId" };
  }

  const internalStatus = subscription
    ? mapStripeSubscriptionStatusToInternal(subscription.status)
    : "pending";
  const tier = subscription ? tierFromSubscription(subscription, null) : "starter";

  await applyOrgSubscriptionUpdate(supabase, {
    orgId,
    newTier: tier,
    newStatus: internalStatus === "active" ? "pending" : internalStatus,
    newExpiresAt: null,
    customerId: subscription?.customer ?? customerIdFromInvoice,
    subscriptionId,
    seats: null,
    billingPeriod: null,
    keepExistingExpires: true,
    context: { eventId: event.id, eventType: event.type },
  });

  await writeOrgBillingHistory(supabase, {
    orgId,
    amountMinor: 0,
    currency: invoice.currency ?? "CZK",
    seats: null,
    tier,
    subscriptionId,
    status: "failed",
  });

  return { status: "processed" };
};

const processStripeOrgEvent = async (
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

  const secret = Deno.env.get("STRIPE_ORG_WEBHOOK_SECRET") || "";
  if (!secret) {
    console.error("STRIPE_ORG_WEBHOOK_SECRET not configured");
    return json(500, { error: "Webhook secret not configured" });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("Stripe-Signature");

  const verification = await verifyStripeWebhookSignature(rawBody, signatureHeader, secret);
  if (!verification.valid) {
    console.warn("Stripe org webhook signature invalid:", verification.reason);
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
    const registration = await registerStripeOrgWebhookEvent(supabase, event.id, event.type);
    if (registration.duplicate) {
      return json(200, { received: true, duplicate: true, type: event.type });
    }

    const result = await processStripeOrgEvent(supabase, event);
    await markStripeOrgWebhookStatus(supabase, event.id, result.status, result.note);
    return json(200, {
      received: true,
      type: event.type,
      status: result.status,
      ...(result.note ? { note: result.note } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Stripe org webhook:", message);
    try {
      await markStripeOrgWebhookStatus(supabase, event.id, "failed", message);
    } catch {
      // best-effort
    }
    return json(500, { error: message });
  }
});
