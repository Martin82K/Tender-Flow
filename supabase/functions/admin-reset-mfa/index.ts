import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

interface ResetMfaPayload {
  userId?: string;
  confirmationEmail?: string;
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const decodeJwtPayload = (req: Request): Record<string, unknown> => {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const [, payload] = token.split(".");
  if (!payload) return {};

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ResetMfaPayload;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const confirmationEmail =
      typeof body.confirmationEmail === "string" ? body.confirmationEmail.trim().toLowerCase() : "";

    if (!userId || !confirmationEmail) {
      return json(req, 400, { error: "Chybí userId nebo confirmationEmail." });
    }

    const authed = createAuthedUserClient(req);
    const { data: callerData, error: callerError } = await authed.auth.getUser();
    if (callerError || !callerData.user) {
      return json(req, 401, { error: "Unauthorized" });
    }

    if (callerData.user.id === userId) {
      return json(req, 400, { error: "Admin reset MFA nelze použít na vlastní účet." });
    }

    const claims = decodeJwtPayload(req);
    if (claims.aal !== "aal2") {
      return json(req, 403, { error: "Pro reset MFA je vyžadována admin session na úrovni AAL2." });
    }

    const { data: isAdmin, error: adminError } = await authed.rpc("is_admin");
    if (adminError || isAdmin !== true) {
      return json(req, 403, { error: "Forbidden" });
    }

    const service = createServiceClient();
    const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
    const targetEmail = targetData?.user?.email?.toLowerCase() || "";
    if (targetError || !targetData?.user) {
      return json(req, 404, { error: "Uživatel nebyl nalezen." });
    }
    if (targetEmail !== confirmationEmail) {
      return json(req, 400, { error: "Potvrzovací email neodpovídá cílovému účtu." });
    }

    const adminMfa = service.auth.admin.mfa as {
      listFactors: (params: { userId: string }) => Promise<{
        data: { factors: Array<{ id: string; status?: string; factor_type?: string }> } | null;
        error: Error | null;
      }>;
      deleteFactor: (params: { userId: string; id: string }) => Promise<{
        data: unknown;
        error: Error | null;
      }>;
    };

    const { data: factorsData, error: factorsError } = await adminMfa.listFactors({ userId });
    if (factorsError) {
      return json(req, 500, { error: "Nepodařilo se načíst MFA faktory uživatele." });
    }

    const factors = Array.isArray(factorsData?.factors) ? factorsData.factors : [];
    let deletedFactors = 0;

    for (const factor of factors) {
      if (!factor.id) continue;
      const { error: deleteError } = await adminMfa.deleteFactor({
        userId,
        id: factor.id,
      });
      if (deleteError) {
        return json(req, 500, { error: "Nepodařilo se odstranit MFA faktor uživatele." });
      }
      deletedFactors += 1;
    }

    await service.from("admin_audit_events").insert({
      actor: callerData.user.email || callerData.user.id,
      action: "admin_reset_mfa",
      target_type: "auth_user",
      target_id: userId,
      summary: `Admin resetoval MFA faktory uživatele ${targetEmail}. Počet odstraněných faktorů: ${deletedFactors}.`,
    });

    return json(req, 200, {
      success: true,
      deletedFactors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-reset-mfa] Unexpected error:", message);
    return json(req, 500, { error: "Reset MFA selhal." });
  }
});
