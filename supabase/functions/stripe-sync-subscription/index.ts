import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

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

Deno.serve(async (req) => {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        // Get authenticated user
        const authed = createAuthedUserClient(req);
        const { data: userData, error: userError } = await authed.auth.getUser();
        if (userError || !userData.user) {
            return json(401, { error: "Unauthorized" });
        }

        const userId = userData.user.id;
        const service = createServiceClient();
        const stripe = getStripeClient();

        // Get user's Stripe customer ID from DB
        const { data: profile, error: profileError } = await service
            .from("user_profiles")
            .select("stripe_customer_id, billing_subscription_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (profileError) {
            return json(500, { error: "Failed to load user profile" });
        }

        if (!profile?.stripe_customer_id) {
            return json(200, {
                success: true,
                message: "No Stripe customer found, nothing to sync",
                subscription: null,
            });
        }

        // Get all active subscriptions for this customer from Stripe
        const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            status: "all", // Get all statuses
            limit: 1, // Most recent
        });

        if (subscriptions.data.length === 0) {
            // No subscription - set to free
            await service
                .from("user_profiles")
                .update({
                    subscription_tier_override: "free",
                    subscription_status: "expired",
                    subscription_expires_at: null,
                    subscription_cancel_at_period_end: false,
                    billing_subscription_id: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

            return json(200, {
                success: true,
                message: "No active subscription found, reset to free",
                subscription: null,
            });
        }

        const subscription = subscriptions.data[0];
        const priceToTier = getPriceToTierMap();

        // Determine tier from price
        const priceId = subscription.items.data[0]?.price.id || "";
        const tier = priceToTier[priceId] || subscription.metadata?.tier || "starter";

        // Determine status
        let status: "active" | "cancelled" | "expired" = "active";
        const isCancelAtPeriodEnd = subscription.cancel_at_period_end;

        if (subscription.status === "canceled" || subscription.status === "unpaid") {
            status = "expired";
        } else if (isCancelAtPeriodEnd) {
            status = "cancelled";
        }

        // Get expiration date
        const expiresAt = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

        // Update DB with fresh data from Stripe
        const { error: updateError } = await service
            .from("user_profiles")
            .update({
                subscription_tier_override: tier,
                subscription_status: status,
                subscription_expires_at: expiresAt,
                subscription_cancel_at_period_end: isCancelAtPeriodEnd,
                billing_subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (updateError) {
            console.error("Failed to update user profile:", updateError);
            return json(500, { error: "Failed to update subscription data" });
        }

        // Log the sync
        await service.from("subscription_audit_log").insert({
            user_id: userId,
            changed_by: userId, // User initiated
            old_tier: null,
            new_tier: tier,
            change_type: "manual_sync",
            notes: `Synced from Stripe: ${subscription.id}, status=${status}, expires=${expiresAt}`,
        });

        return json(200, {
            success: true,
            message: "Subscription synced from Stripe",
            subscription: {
                id: subscription.id,
                tier,
                status,
                expiresAt,
                cancelAtPeriodEnd: isCancelAtPeriodEnd,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error syncing subscription:", message);
        return json(500, { error: message });
    }
});
