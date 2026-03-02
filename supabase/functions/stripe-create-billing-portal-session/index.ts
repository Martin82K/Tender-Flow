import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import {
  getStripeClient,
  loadBillingProfile,
  resolveBillingCustomerId,
  validateAllowedRedirectUrl,
} from "../_shared/stripeBilling.ts";

interface PortalRequest {
  returnUrl?: string;
}

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
    const body = (await req.json().catch(() => ({}))) as PortalRequest;
    const returnUrl =
      body.returnUrl ||
      Deno.env.get("SITE_URL") ||
      "http://localhost:3000";
    if (!validateAllowedRedirectUrl(returnUrl)) {
      return json(400, { error: "Redirect URL is not allowed" });
    }

    const stripe = getStripeClient();
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const service = createServiceClient();
    const profile = await loadBillingProfile(service, userData.user.id);
    const customerId = resolveBillingCustomerId(profile);
    if (!customerId) {
      return json(400, { error: "Stripe customer not found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return json(200, { success: true, portalUrl: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
