import Stripe from "npm:stripe@14.21.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

interface PortalRequest {
  returnUrl?: string;
}

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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PortalRequest;
    const returnUrl =
      body.returnUrl ||
      Deno.env.get("SITE_URL") ||
      "http://localhost:3000";

    const stripe = getStripeClient();
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const service = createServiceClient();
    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: "Failed to load user profile" });
    }

    if (!profile?.stripe_customer_id) {
      return json(400, { error: "Stripe customer not found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return json(200, { success: true, portalUrl: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
