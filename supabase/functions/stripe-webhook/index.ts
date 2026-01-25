import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

// Map Stripe price IDs to tier names
const getPriceToTierMap = () => {
    return {
        [Deno.env.get("STRIPE_PRICE_ID_STARTER_MONTHLY") || ""]: "starter",
        [Deno.env.get("STRIPE_PRICE_ID_STARTER_YEARLY") || ""]: "starter",
        [Deno.env.get("STRIPE_PRICE_ID_PRO_MONTHLY") || ""]: "pro",
        [Deno.env.get("STRIPE_PRICE_ID_PRO_YEARLY") || ""]: "pro",
        [Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_MONTHLY") || ""]: "enterprise",
        [Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_YEARLY") || ""]: "enterprise",
    };
};

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

// Update user subscription in database
async function updateUserSubscription(
    userId: string,
    tier: string,
    status: "active" | "cancelled" | "expired",
    expiresAt: Date | null,
    stripeSubscriptionId: string | null,
    stripeCustomerId: string | null
) {
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {
        subscription_tier_override: tier,
        subscription_status: status,
        subscription_cancel_at_period_end: status === 'cancelled', // Explicitly set based on status
        subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
        billing_subscription_id: stripeSubscriptionId,
        billing_provider: "stripe",
        updated_at: new Date().toISOString(),
    };

    if (stripeCustomerId) {
        updateData.billing_customer_id = stripeCustomerId;
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
    await supabase.from("subscription_audit_log").insert({
        user_id: userId,
        changed_by: null, // System change
        old_tier: null, // We don't track old tier here
        new_tier: tier,
        change_type: "stripe_webhook",
        notes: `Stripe subscription ${status}: ${stripeSubscriptionId}`,
    });

    console.log(`Updated subscription for user ${userId}: tier=${tier}, status=${status}`);
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    const stripe = getStripeClient();
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
                        userId,
                        tier,
                        "active",
                        expiresAt,
                        subscription.id,
                        session.customer as string
                    );
                }
                break;
            }

            // Subscription updated (e.g., plan change, renewal)
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                console.log("Subscription updated:", subscription.id);

                const userId = subscription.metadata?.userId;
                if (!userId) {
                    console.error("No userId in subscription metadata");
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
                    userId,
                    tier,
                    status,
                    expiresAt,
                    subscription.id,
                    subscription.customer as string
                );
                break;
            }

            // Subscription deleted (cancelled and period ended)
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                console.log("Subscription deleted:", subscription.id);

                const userId = subscription.metadata?.userId;
                if (!userId) {
                    console.error("No userId in subscription metadata");
                    break;
                }

                // Downgrade to free tier
                await updateUserSubscription(
                    userId,
                    "free",
                    "expired",
                    null,
                    null,
                    subscription.customer as string
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
        }

        return json(200, { received: true, type: event.type });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error processing webhook:", message);
        return json(500, { error: message });
    }
});
