// Edge Function: delete-user-account
//
// Owner-only hard deletion of an organization member.
//
// Flow:
//   1. Authenticate caller via JWT (authed client).
//   2. Call RPC `delete_org_member_account` under the caller's identity —
//      all ownership / authorization checks happen server-side in SQL.
//   3. On success, the RPC has already transferred data & removed the
//      membership. This function then deletes the auth.users row using
//      the service role (admin API).
//
// Safety:
//   - Authorization checks live in SQL (single source of truth).
//   - Double-confirmation: caller must pass the target's email verbatim.
//   - auth.users deletion runs only AFTER the RPC returns success.

import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

interface DeletePayload {
  orgId?: string;
  userId?: string;
  confirmationEmail?: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
    });

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as DeletePayload;
    const { orgId, userId, confirmationEmail } = body;

    if (!orgId || !userId || !confirmationEmail) {
      return json(400, {
        error: "Chybí povinné parametry (orgId, userId, confirmationEmail).",
      });
    }

    // 1. Authenticate caller
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    // 2. Caller identity must not match target (extra guard; RPC checks too)
    if (userData.user.id === userId) {
      return json(400, { error: "Nelze smazat vlastní účet." });
    }

    // 3. Invoke RPC under caller's JWT (enforces owner-only)
    const { data: rpcData, error: rpcError } = await authed.rpc(
      "delete_org_member_account",
      {
        org_id_input: orgId,
        user_id_input: userId,
        confirmation_email: confirmationEmail,
      },
    );

    if (rpcError) {
      const message = rpcError.message || "RPC failed";
      // Map common authorization errors to HTTP 403 so the UI can display a
      // meaningful permission-denied message.
      const lower = message.toLowerCase();
      const isAuthError =
        lower.includes("not authorized") ||
        lower.includes("only organization owner") ||
        lower.includes("cannot delete");
      return json(isAuthError ? 403 : 400, { error: message });
    }

    // 4. Delete auth.users via admin API (service role)
    //    At this point the member is already out of the organization.
    const service = createServiceClient();
    const { error: deleteUserError } = await service.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      // Membership was removed but auth.users deletion failed.
      // Log prominently — the owner should retry or contact support.
      console.error(
        "[delete-user-account] auth.users deletion failed after RPC success",
        {
          orgId,
          userId,
          error: deleteUserError.message,
        },
      );
      return json(500, {
        error:
          "Uživatel byl odebrán z organizace, ale smazání jeho účtu z autentizace selhalo. Kontaktujte podporu.",
        partialSuccess: true,
        rpcResult: rpcData,
      });
    }

    return json(200, {
      success: true,
      rpcResult: rpcData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[delete-user-account] Unexpected error:", message);
    return json(500, { error: message });
  }
});
