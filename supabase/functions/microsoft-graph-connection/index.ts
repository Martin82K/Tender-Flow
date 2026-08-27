import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type Action = "connect" | "status" | "disconnect";

type MicrosoftIdentity = {
  provider?: string | null;
  provider_id?: string | null;
  id?: string | null;
  identity_data?: Record<string, unknown> | null;
};

const MICROSOFT_PROVIDERS = new Set(["azure", "microsoft", "onedrive"]);
const MAX_TOKEN_LENGTH = 64 * 1024;

type MicrosoftConnectionErrorCode =
  | "microsoft_identity_missing"
  | "microsoft_identity_mismatch"
  | "microsoft_graph_token_invalid"
  | "microsoft_oauth_not_configured"
  | "microsoft_oauth_configuration_mismatch"
  | "microsoft_refresh_token_rejected";

class MicrosoftConnectionError extends Error {
  constructor(
    readonly code: MicrosoftConnectionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const assertOAuthApplicationMatches = (accessToken: string, configuredClientId: string) => {
  const payload = decodeJwtPayload(accessToken);
  const tokenClientId = normalize(payload?.azp || payload?.appid);
  if (tokenClientId && tokenClientId !== normalize(configuredClientId)) {
    throw new MicrosoftConnectionError(
      "microsoft_oauth_configuration_mismatch",
      "Konfigurace Microsoft přihlášení v Tender Flow není sjednocená.",
    );
  }
};

const identityValues = (identity: MicrosoftIdentity): { emails: string[]; subjects: string[] } => {
  const data = identity.identity_data || {};
  return {
    emails: [data.email, data.preferred_username, data.upn].map(normalize).filter(Boolean),
    subjects: [identity.provider_id, identity.id, data.sub, data.oid, data.id]
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter(Boolean),
  };
};

const fetchGraphUser = async (accessToken: string): Promise<{ id: string; email: string }> => {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new MicrosoftConnectionError(
      "microsoft_graph_token_invalid",
      "Microsoft Graph token se nepodařilo ověřit.",
    );
  }
  return {
    id: typeof payload.id === "string" ? payload.id.trim() : "",
    email: normalize(payload.mail || payload.userPrincipalName),
  };
};

const assertGraphIdentityMatches = (args: {
  graphUser: { id: string; email: string };
  userEmail: string | null | undefined;
  identities: MicrosoftIdentity[];
}) => {
  const microsoftIdentities = args.identities.filter((identity) =>
    Boolean(identity.provider && MICROSOFT_PROVIDERS.has(identity.provider))
  );
  if (microsoftIdentities.length === 0) {
    throw new MicrosoftConnectionError(
      "microsoft_identity_missing",
      "Microsoft účet není propojený s uživatelem Tender Flow.",
    );
  }

  const emails = new Set([normalize(args.userEmail)]);
  const subjects = new Set<string>();
  for (const identity of microsoftIdentities) {
    const values = identityValues(identity);
    values.emails.forEach((email) => emails.add(email));
    values.subjects.forEach((subject) => subjects.add(subject));
  }
  emails.delete("");

  if (!emails.has(args.graphUser.email) && !subjects.has(args.graphUser.id)) {
    throw new MicrosoftConnectionError(
      "microsoft_identity_mismatch",
      "Přihlášený Microsoft účet neodpovídá uživateli Tender Flow.",
    );
  }
};

const refreshForConfiguredApplication = async (refreshToken: string) => {
  const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("MS_OAUTH_CLIENT_SECRET") || "";
  const tenant = Deno.env.get("MS_OAUTH_TENANT") || Deno.env.get("MS_OAUTH_TENANT_ID") || "organizations";
  if (!clientId || !clientSecret) {
    throw new MicrosoftConnectionError(
      "microsoft_oauth_not_configured",
      "Microsoft připojení není na serveru nakonfigurované.",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access https://graph.microsoft.com/.default",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    const providerCode = typeof payload?.error === "string" ? payload.error : "";
    throw new MicrosoftConnectionError(
      providerCode === "invalid_client"
        ? "microsoft_oauth_configuration_mismatch"
        : "microsoft_refresh_token_rejected",
      providerCode === "invalid_client"
        ? "Konfigurace Microsoft přihlášení v Tender Flow není sjednocená."
        : "Microsoft připojení se nepodařilo ověřit. Přihlaste se prosím znovu.",
    );
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const action = body?.action as Action | undefined;
    if (!action || !(["connect", "status", "disconnect"] as const).includes(action)) {
      return json(req, 400, { error: "Invalid action" });
    }

    const service = createServiceClient();
    const userId = userData.user.id;

    if (action === "status") {
      const { data, error } = await service.from("dochub_user_tokens")
        .select("access_kind")
        .eq("user_id", userId)
        .eq("provider", "onedrive")
        .in("access_kind", ["microsoft_graph", "personal_read", "todo_sync"]);
      if (error) return json(req, 500, { error: "Microsoft connection status unavailable" });
      const kinds = new Set((data ?? []).map((row) => row.access_kind as string));
      return json(req, 200, {
        connected: kinds.has("microsoft_graph") || (kinds.has("personal_read") && kinds.has("todo_sync")),
      });
    }

    if (action === "disconnect") {
      const results = await Promise.all([
        service.from("dochub_user_tokens").delete()
          .eq("user_id", userId)
          .eq("provider", "onedrive")
          .in("access_kind", ["microsoft_graph", "personal_read", "todo_sync"]),
        service.from("microsoft_todo_list_mappings").delete().eq("user_id", userId),
        service.from("microsoft_todo_tombstones").delete().eq("user_id", userId),
        service.from("microsoft_todo_sync_locks").delete().eq("user_id", userId),
      ]);
      if (results.some((result) => result.error)) {
        return json(req, 500, { error: "Microsoft connection could not be removed" });
      }
      return json(req, 200, { connected: false });
    }

    const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
    if (!accessToken || !refreshToken || accessToken.length > MAX_TOKEN_LENGTH || refreshToken.length > MAX_TOKEN_LENGTH) {
      return json(req, 400, { error: "Invalid Microsoft provider tokens" });
    }

    const { data: storedUser, error: storedUserError } = await service.auth.admin.getUserById(userId);
    if (storedUserError || !storedUser.user) return json(req, 401, { error: "User unavailable" });

    const initialGraphUser = await fetchGraphUser(accessToken);
    assertGraphIdentityMatches({
      graphUser: initialGraphUser,
      userEmail: storedUser.user.email,
      identities: (storedUser.user.identities || []) as MicrosoftIdentity[],
    });

    // Refreshing with the server-side client proves Supabase Azure and Graph use
    // the same Entra application registration before the token is persisted.
    const configuredClientId = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
    if (!configuredClientId) {
      throw new MicrosoftConnectionError(
        "microsoft_oauth_not_configured",
        "Microsoft připojení není na serveru nakonfigurované.",
      );
    }
    assertOAuthApplicationMatches(accessToken, configuredClientId);
    const refreshed = await refreshForConfiguredApplication(refreshToken);
    const refreshedGraphUser = await fetchGraphUser(refreshed.access_token);
    assertGraphIdentityMatches({
      graphUser: refreshedGraphUser,
      userEmail: storedUser.user.email,
      identities: (storedUser.user.identities || []) as MicrosoftIdentity[],
    });

    const encryptionKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) return json(req, 500, { error: "Token encryption is not configured" });
    const tokenCiphertext = await encryptJsonAesGcm({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || refreshToken,
      scope: refreshed.scope || null,
      token_type: refreshed.token_type || "Bearer",
      provider_subject: refreshedGraphUser.id,
      provider_email: refreshedGraphUser.email,
    }, encryptionKey);

    const { error: tokenStoreError } = await service.from("dochub_user_tokens").upsert({
      user_id: userId,
      provider: "onedrive",
      access_kind: "microsoft_graph",
      token_ciphertext: tokenCiphertext,
      scopes: refreshed.scope?.split(" ").filter(Boolean) || [],
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (tokenStoreError) return json(req, 500, { error: "Microsoft token could not be stored" });

    await service.from("dochub_user_tokens").delete()
      .eq("user_id", userId)
      .eq("provider", "onedrive")
      .in("access_kind", ["personal_read", "todo_sync"]);

    return json(req, 200, { connected: true });
  } catch (cause) {
    if (cause instanceof MicrosoftConnectionError) {
      return json(req, 400, { error: cause.message, code: cause.code });
    }
    return json(req, 400, { error: "Microsoft připojení se nepodařilo dokončit." });
  }
});
