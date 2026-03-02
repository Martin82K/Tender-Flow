import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getPriceToTierMap, getStripeClient } from "../_shared/stripeBilling.ts";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

type ProcessStatus = "processed" | "ignored";
type SubscriptionStatus = "active" | "cancelled" | "expired";

// Update user subscription in database
async function updateUserSubscription(
    supabase: ReturnType<typeof createServiceClient>,
    userId: string,
    tier: string,
    status: SubscriptionStatus,
    expiresAt: Date | null,
    stripeSubscriptionId: string | null,
    stripeCustomerId: string | null,
    context: {
        eventId: string;
        eventType: string;
    },
) {
    // NOTE: We update stripe_subscription_tier, NOT subscription_tier_override
    // subscription_tier_override is for admin-set values only
    const updateData: Record<string, unknown> = {
        stripe_subscription_tier: tier,
        subscription_status: status,
        subscription_cancel_at_period_end: status === 'cancelled', // Explicitly set based on status
        subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
        billing_subscription_id: stripeSubscriptionId,
        billing_provider: "stripe",
        updated_at: new Date().toISOString(),
    };

    if (stripeCustomerId) {
        updateData.billing_customer_id = stripeCustomerId;
        updateData.stripe_customer_id = stripeCustomerId;
    }

    const { error } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("user_id", userId);

    if (error) {
        console.error("Failed to update user subscription:", error);
        throw error;
    }

    // Log the change in audit table
    const notes = [
        `eventType=${context.eventType}`,
        `eventId=${context.eventId}`,
        `customer=${stripeCustomerId || "n/a"}`,
        `subscription=${stripeSubscriptionId || "n/a"}`,
        `status=${status}`,
    ].join("; ");

    const { error: auditError } = await supabase.from("subscription_audit_log").insert({
        user_id: userId,
        changed_by: null, // System change
        old_tier: null, // We don't track old tier here
        new_tier: tier,
        change_type: "stripe_webhook",
        notes,
    });
    if (auditError) {
        console.error("Failed to write subscription audit log:", auditError);
    }

    console.log(`Updated subscription for user ${userId}: tier=${tier}, status=${status}`);
}

const markWebhookStatus = async (
    supabase: ReturnType<typeof createServiceClient>,
    eventId: string,
    status: "processed" | "ignored" | "failed",
    errorMessage?: string,
) => {
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

const registerWebhookEvent = async (
    supabase: ReturnType<typeof createServiceClient>,
    event: Stripe.Event,
): Promise<{ duplicate: boolean }> => {
    const payloadSummary = {
        id: event.id,
        type: event.type,
        created: event.created,
        livemode: event.livemode,
    };

    const { error } = await supabase.from("billing_webhook_events").insert({
        event_id: event.id,
        event_type: event.type,
        status: "received",
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

const resolveUserIdFromSubscription = async (
    supabase: ReturnType<typeof createServiceClient>,
    subscription: Stripe.Subscription,
): Promise<string | null> => {
    if (subscription.metadata?.userId) {
        return subscription.metadata.userId;
    }

    const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("billing_subscription_id", subscription.id)
        .maybeSingle();

    if (error) {
        console.error("Failed to resolve user by subscription ID:", error);
        return null;
    }

    return data?.user_id || null;
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    const stripe = getStripeClient();
    const supabase = createServiceClient();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    if (!webhookSecret) {
        console.error("Missing STRIPE_WEBHOOK_SECRET");
        return json(500, { error: "Webhook not configured" });
    }

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return json(400, { error: "Missing stripe-signature header" });
    }

    // Get the raw body
    const body = await req.text();

    let event: Stripe.Event;

    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Webhook signature verification failed:", message);
        return json(400, { error: `Webhook Error: ${message}` });
    }

    const priceToTier = getPriceToTierMap();

    try {
        const registration = await registerWebhookEvent(supabase, event);
        if (registration.duplicate) {
            return json(200, { received: true, duplicate: true, type: event.type });
        }

        let processStatus: ProcessStatus = "processed";

        switch (event.type) {
            // Checkout completed - user just paid for a subscription
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log("Checkout session completed:", session.id);

                if (session.mode === "subscription" && session.subscription) {
                    const userId = session.metadata?.userId || session.client_reference_id;
                    if (!userId) {
                        console.error("No userId in checkout session metadata");
                        break;
                    }

                    // Get subscription details
                    const subscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    );

                    const priceId = subscription.items.data[0]?.price.id || "";
                    const tier = priceToTier[priceId] || session.metadata?.tier || "starter";
                    const expiresAt = subscription.current_period_end
                        ? new Date(subscription.current_period_end * 1000)
                        : null;

                    await updateUserSubscription(
                        supabase,
                        userId,
                        tier,
                        "active",
                        expiresAt,
                        subscription.id,
                        session.customer as string,
                        {
                            eventId: event.id,
                            eventType: event.type,
                        },
                    );
                } else {
                    processStatus = "ignored";
                }
                break;
            }

            // Subscription updated (e.g., plan change, renewal)
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                console.log("Subscription updated:", subscription.id);

                const userId = await resolveUserIdFromSubscription(supabase, subscription);
                if (!userId) {
                    console.error("No userId in subscription metadata");
                    processStatus = "ignored";
                    break;
                }

                const priceId = subscription.items.data[0]?.price.id || "";
                const tier = priceToTier[priceId] || subscription.metadata?.tier || "starter";
                const expiresAt = subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : null;

                let status: "active" | "cancelled" | "expired" = "active";
                if (subscription.cancel_at_period_end) {
                    status = "cancelled";
                } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
                    status = "expired";
                }

                await updateUserSubscription(
                    supabase,
                    userId,
                    tier,
                    status,
                    expiresAt,
                    subscription.id,
                    subscription.customer as string,
                    {
                        eventId: event.id,
                        eventType: event.type,
                    },
                );
                break;
            }

            // Subscription deleted (cancelled and period ended)
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                console.log("Subscription deleted:", subscription.id);

                const userId = await resolveUserIdFromSubscription(supabase, subscription);
                if (!userId) {
                    console.error("No userId in subscription metadata");
                    processStatus = "ignored";
                    break;
                }

                // Downgrade to free tier
                await updateUserSubscription(
                    supabase,
                    userId,
                    "free",
                    "expired",
                    null,
                    null,
                    subscription.customer as string,
                    {
                        eventId: event.id,
                        eventType: event.type,
                    },
                );
                break;
            }

            // Payment failed - notify user (could also downgrade after X failures)
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                console.log("Invoice payment failed:", invoice.id);

                // For now, just log it. Could send email notification here.
                const subscriptionId = invoice.subscription as string;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const userId = subscription.metadata?.userId;
                    console.warn(`Payment failed for user ${userId}, subscription ${subscriptionId}`);

                    // TODO: Send email notification via Resend
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
                processStatus = "ignored";
        }

        await markWebhookStatus(supabase, event.id, processStatus);
        return json(200, { received: true, type: event.type, status: processStatus });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error processing webhook:", message);
        await markWebhookStatus(supabase, event.id, "failed", message);
        return json(500, { error: message });
    }
});
