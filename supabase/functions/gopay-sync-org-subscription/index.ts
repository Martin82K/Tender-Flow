import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getPaymentStatus, getAdditionalParam } from "../_shared/gopayBilling.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { orgId?: string };
    const orgId = body.orgId;

    if (!orgId) {
      return json(400, { error: "Missing orgId" });
    }

    // Authenticate user
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const service = createServiceClient();

    // Verify user is member of the organization
    const { data: membership } = await service
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership) {
      return json(403, { error: "Not a member of this organization" });
    }

    // Get org billing info
    const { data: org } = await service
      .from("organizations")
      .select("billing_customer_id, subscription_tier")
      .eq("id", orgId)
      .single();

    const paymentId = org?.billing_customer_id;
    if (!paymentId) {
      return json(400, { success: false, error: "No billing info found for this organization" });
    }

    // Get payment status from GoPay
    const payment = await getPaymentStatus(paymentId);
    if (!payment) {
      return json(404, { error: "Payment not found in GoPay" });
    }

    const state = payment.state;
    const tier = getAdditionalParam(payment.additional_params, "tier") || org.subscription_tier || "free";
    const seats = parseInt(getAdditionalParam(payment.additional_params, "seats") || "1", 10);

    if (state === "PAID") {
      await service
        .from("organizations")
        .update({
          subscription_tier: tier,
          subscription_status: "active",
          max_seats: seats,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgId);

      return json(200, {
        success: true,
        message: "Předplatné organizace bylo synchronizováno.",
        tier,
        status: "active",
      });
    }

    return json(200, {
      success: true,
      message: `Stav platby: ${state}`,
      gopayState: state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing GoPay org subscription:", message);
    return json(500, { error: message });
  }
});
