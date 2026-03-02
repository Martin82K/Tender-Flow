import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
    getPriceToTierMap,
    getStripeClient,
    loadBillingProfile,
    resolveBillingCustomerId,
} from "../_shared/stripeBilling.ts";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

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
        const profile = await loadBillingProfile(service, userId);
        const customerId = resolveBillingCustomerId(profile);
        if (!customerId) {
            return json(200, {
                success: true,
                message: "No Stripe customer found, nothing to sync",
                subscription: null,
            });
        }

        // Get all active subscriptions for this customer from Stripe
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "all", // Get all statuses
            limit: 1, // Most recent
        });

        if (subscriptions.data.length === 0) {
            // No subscription - clear Stripe tier (don't touch admin override!)
            await service
                .from("user_profiles")
                .update({
                    stripe_subscription_tier: null,
                    subscription_status: "expired",
                    subscription_expires_at: null,
                    subscription_cancel_at_period_end: false,
                    billing_subscription_id: null,
                    stripe_customer_id: customerId,
                    billing_customer_id: customerId,
                    billing_provider: "stripe",
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

            return json(200, {
                success: true,
                message: "No active subscription found, Stripe tier cleared",
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
        // NOTE: We update stripe_subscription_tier, NOT subscription_tier_override
        // subscription_tier_override is for admin-set values only
        const { error: updateError } = await service
            .from("user_profiles")
            .update({
                stripe_subscription_tier: tier,
                subscription_status: status,
                subscription_expires_at: expiresAt,
                subscription_cancel_at_period_end: isCancelAtPeriodEnd,
                billing_subscription_id: subscription.id,
                stripe_customer_id: customerId,
                billing_customer_id: customerId,
                billing_provider: "stripe",
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
