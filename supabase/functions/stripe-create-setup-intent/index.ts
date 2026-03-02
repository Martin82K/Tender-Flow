import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getOrCreateBillingCustomer, getStripeClient } from "../_shared/stripeBilling.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const fullName =
      (typeof userData.user.user_metadata?.name === "string" && userData.user.user_metadata.name) ||
      (typeof userData.user.user_metadata?.full_name === "string" && userData.user.user_metadata.full_name) ||
      (typeof userData.user.user_metadata?.display_name === "string" && userData.user.user_metadata.display_name) ||
      null;

    const stripe = getStripeClient();
    const service = createServiceClient();
    const customerId = await getOrCreateBillingCustomer({
      service,
      stripe,
      userId: userData.user.id,
      email: userData.user.email,
      fullName,
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        userId: userData.user.id,
        purpose: "wallet_subscription",
      },
    });

    return json(200, {
      success: true,
      customerId,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
