import { buildCorsHeaders } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Provider = "onedrive";
type AccessKind = "manage" | "personal_read" | "todo_sync" | "microsoft_graph";

const MICROSOFT_GRAPH_DEFAULT_SCOPES = ["offline_access", "openid", "email", "profile", "https://graph.microsoft.com/.default"];
const PERSONAL_READ_SCOPES = ["offline_access", "openid", "email", "profile", "User.Read", "Files.Read.All"];
const MICROSOFT_TODO_SCOPES = ["offline_access", "openid", "email", "profile", "User.Read", "Tasks.ReadWrite"];
const MICROSOFT_MANAGE_SCOPES = ["offline_access", "openid", "email", "profile", "User.Read", "Files.ReadWrite", "Sites.ReadWrite.All"];

const microsoftScopesFor = (accessKind: AccessKind): string[] => {
  if (accessKind === "microsoft_graph") return MICROSOFT_GRAPH_DEFAULT_SCOPES;
  if (accessKind === "personal_read") return PERSONAL_READ_SCOPES;
  if (accessKind === "todo_sync") return MICROSOFT_TODO_SCOPES;
  return MICROSOFT_MANAGE_SCOPES;
};
type ProviderIdentity = {
  audience: string;
  email: string;
  emailVerified: boolean | null;
  subjects: string[];
};
type SupabaseAuthUser = {
  email?: string | null;
  identities?: Array<{
    id?: string | null;
    provider?: string | null;
    provider_id?: string | null;
    identity_data?: Record<string, unknown> | null;
  }> | null;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MICROSOFT_SUPABASE_PROVIDERS = new Set(["azure", "microsoft", "onedrive"]);

const siteBaseUrl = () => {
  const raw = (Deno.env.get("SITE_URL") || "http://localhost:3000").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
};

const defaultReturnTo = () => `${siteBaseUrl()}/app?dochub=1`;

const redirect = (req: Request, to: string) =>
  new Response(null, { status: 302, headers: { ...buildCorsHeaders(req), location: to } });

const withQueryParam = (to: string, key: string, value: string) => {
  try {
    const url = new URL(to);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    const sep = to.includes("?") ? "&" : "?";
    return `${to}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
};

const oauthStateCutoffIso = () => new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString();

const sanitizeReturnTo = (raw: string | null | undefined) => {
  const base = siteBaseUrl();
  const val = (raw || "").trim();
  if (!val) return defaultReturnTo();

  try {
    const u = new URL(val);
    if (u.origin !== base) return defaultReturnTo();

    const p = u.pathname || "/";
    const blockedPrefixes = ["/@vite/", "/node_modules/", "/src/"];
    if (blockedPrefixes.some((prefix) => p.startsWith(prefix))) return defaultReturnTo();
    if (/\.(ts|tsx|js|jsx|map)$/.test(p)) return defaultReturnTo();

    if (!p.startsWith("/app")) {
      u.pathname = "/app";
      u.searchParams.set("dochub", "1");
    }
    return u.toString();
  } catch {
    return defaultReturnTo();
  }
};

const tryResolveReturnTo = async (state: string | null): Promise<string | null> => {
  if (!state) return null;
  const [provider, nonce] = state.split(".", 2);
  if (provider !== "onedrive" || !nonce) return null;

  const service = createServiceClient();
  const { data } = await service
    .from("dochub_oauth_states")
    .select("return_to")
    .eq("nonce", nonce)
    .eq("provider", provider as Provider)
    .maybeSingle();

  const returnTo = data?.return_to as string | null | undefined;
  return returnTo && returnTo.trim() ? returnTo.trim() : null;
};

const tokenExchangeMicrosoft = async (args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenant: string;
  accessKind: AccessKind;
}) => {
  const body = new URLSearchParams();
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  body.set("code", args.code);
  body.set("redirect_uri", args.redirectUri);
  body.set("grant_type", "authorization_code");
  body.set(
    "scope",
    microsoftScopesFor(args.accessKind).join(" ")
  );

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(args.tenant)}/oauth2/v2.0/token`,
    {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || "Microsoft token exchange failed");
  return json as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type: string;
    id_token?: string;
  };
};

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const normalizeSubject = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const uniqueSubjects = (values: unknown[]): string[] =>
  Array.from(new Set(values.map(normalizeSubject).filter(Boolean)));

const decodeBase64UrlJson = (value: string): Record<string, unknown> => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
};

const decodeJwtPayload = (jwt: string): Record<string, unknown> => {
  const [, payload] = jwt.split(".");
  if (!payload) throw new Error("Invalid Microsoft id_token");
  return decodeBase64UrlJson(payload);
};

const collectExpectedIdentity = (user: SupabaseAuthUser) => {
  const emails = new Set<string>();
  const subjects = new Set<string>();
  const userEmail = normalizeEmail(user.email);
  if (userEmail) emails.add(userEmail);

  for (const identity of user.identities || []) {
    if (!identity.provider || !MICROSOFT_SUPABASE_PROVIDERS.has(identity.provider)) continue;
    const data = identity.identity_data || {};
    const identityEmail = normalizeEmail(data.email || data.preferred_username || data.upn);
    if (identityEmail) emails.add(identityEmail);

    for (const candidate of [identity.provider_id, identity.id, data.sub, data.oid, data.id]) {
      const subject = normalizeSubject(candidate);
      if (subject) subjects.add(subject);
    }
  }

  return { emails, subjects };
};

const assertIdentityBoundToUser = (args: {
  identity: ProviderIdentity;
  user: SupabaseAuthUser;
  clientId: string;
}) => {
  if (args.identity.audience !== args.clientId) {
    throw new Error("OAuth provider audience mismatch");
  }
  if (!args.identity.email || args.identity.subjects.length === 0) {
    throw new Error("OAuth provider identity missing");
  }
  if (args.identity.emailVerified === false) {
    throw new Error("OAuth provider email not verified");
  }

  const expected = collectExpectedIdentity(args.user);
  const emailMatch = expected.emails.has(normalizeEmail(args.identity.email));
  const subjectMatch = args.identity.subjects.some((subject) => expected.subjects.has(subject));

  if (!emailMatch && !subjectMatch) {
    throw new Error("OAuth provider identity does not match signed-in user");
  }
};

const getStateUser = async (
  service: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<SupabaseAuthUser> => {
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    throw new Error("OAuth state user not found");
  }
  return data.user as SupabaseAuthUser;
};

const fetchMicrosoftUserInfo = async (accessToken: string): Promise<{
  id: string;
  email: string;
}> => {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Microsoft userinfo verification failed");

  return {
    id: normalizeSubject(json.id),
    email: normalizeEmail(json.mail || json.userPrincipalName),
  };
};

const verifyMicrosoftIdentity = async (args: {
  token: Awaited<ReturnType<typeof tokenExchangeMicrosoft>>;
  clientId: string;
  user: SupabaseAuthUser;
}): Promise<ProviderIdentity> => {
  if (!args.token.id_token) {
    throw new Error("Missing Microsoft id_token");
  }

  const claims = decodeJwtPayload(args.token.id_token);
  const audience = Array.isArray(claims.aud) ? String(claims.aud[0] || "") : String(claims.aud || "");
  const claimEmail = normalizeEmail(claims.email || claims.preferred_username || claims.upn);
  const claimSubjects = uniqueSubjects([claims.sub, claims.oid]);
  const graphUser = await fetchMicrosoftUserInfo(args.token.access_token);

  if (claimEmail && graphUser.email && claimEmail !== graphUser.email) {
    throw new Error("Microsoft id_token/userinfo email mismatch");
  }

  const identity = {
    audience,
    email: claimEmail || graphUser.email,
    emailVerified: true,
    subjects: Array.from(new Set([...claimSubjects, graphUser.id].filter(Boolean))),
  };
  assertIdentityBoundToUser({ identity, user: args.user, clientId: args.clientId });
  return identity;
};

const consumeFreshOAuthState = async (args: {
  service: ReturnType<typeof createServiceClient>;
  provider: Provider;
  nonce: string;
}) => {
  const { data, error } = await args.service
    .from("dochub_oauth_states")
    .delete()
    .eq("nonce", args.nonce)
    .eq("provider", args.provider)
    .gte("created_at", oauthStateCutoffIso())
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    await args.service
      .from("dochub_oauth_states")
      .delete()
      .eq("nonce", args.nonce)
      .eq("provider", args.provider);
  }
  return data;
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const errorCodes = url.searchParams.get("error_codes");

    if (error) {
      const returnTo = await tryResolveReturnTo(state);
      let to = withQueryParam(sanitizeReturnTo(returnTo), "dochub_error", error);
      if (errorCodes) to = withQueryParam(to, "dochub_error_codes", errorCodes);
      if (errorDescription) {
        const trimmed = errorDescription.length > 600 ? `${errorDescription.slice(0, 600)}…` : errorDescription;
        to = withQueryParam(to, "dochub_error_description", trimmed);
      }
      return redirect(req, to);
    }
    if (!code || !state) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "missing_code_or_state"));
    }

    const [provider, nonce] = state.split(".", 2);
    if (provider !== "onedrive" || !nonce) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "invalid_state"));
    }

    const service = createServiceClient();
    const stateRow = await consumeFreshOAuthState({
      service,
      nonce,
      provider: provider as Provider,
    });

    if (!stateRow) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "state_not_found_or_expired"));
    }

    const { data: subscription, error: subscriptionError } = await service.rpc('get_effective_user_tier', { target_user_id: stateRow.user_id });
    if (subscriptionError || !['starter', 'pro', 'enterprise', 'admin'].includes(subscription?.tier)) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "subscription_required"));
    }

    const accessKind: AccessKind = stateRow.access_kind === "personal_read"
      ? "personal_read"
      : stateRow.access_kind === "todo_sync"
        ? "todo_sync"
        : stateRow.access_kind === "microsoft_graph"
          ? "microsoft_graph"
          : "manage";
    const requiresProject = accessKind === "manage" || Boolean(stateRow.project_id);
    const skipProjectMutation = accessKind !== "manage";
    let project: { id: string; owner_id: string | null } | null = null;

    if (requiresProject) {
      const { data: projectData, error: projectAccessError } = await service
        .from("projects")
        .select("id, owner_id")
        .eq("id", stateRow.project_id)
        .maybeSingle();
      project = projectData;
      if (projectAccessError || !project?.owner_id) {
        return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));
      }
      if (!skipProjectMutation && project.owner_id !== stateRow.user_id) {
        return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));
      }
      if (skipProjectMutation && project.owner_id !== stateRow.user_id) {
        const { data: share, error: shareError } = await service
          .from("project_shares")
          .select("project_id")
          .eq("project_id", project.id)
          .eq("user_id", stateRow.user_id)
          .maybeSingle();
        if (shareError || !share) {
          return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));
        }
      }
    }

    const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("MS_OAUTH_CLIENT_SECRET") || "";
    const redirectUri = Deno.env.get("MS_OAUTH_REDIRECT_URI") || "";
    const tenant =
      Deno.env.get("MS_OAUTH_TENANT") ||
      Deno.env.get("MS_OAUTH_TENANT_ID") ||
      "organizations";
    const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");

    if (!clientId || !clientSecret || !redirectUri || !encKey) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "missing_oauth_env"));
    }

    const token = await tokenExchangeMicrosoft({ code, clientId, clientSecret, redirectUri, tenant, accessKind });
    const stateUser = await getStateUser(service, stateRow.user_id);
    const providerIdentity = await verifyMicrosoftIdentity({ token, clientId, user: stateUser });
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const tokenCiphertext = await encryptJsonAesGcm(
      {
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        scope: token.scope || null,
        token_type: token.token_type,
        provider_subject: providerIdentity.subjects[0] || null,
        provider_email: providerIdentity.email,
        provider_audience: providerIdentity.audience,
      },
      encKey
    );

    const { error: tokenStoreError } = await service.from("dochub_user_tokens").upsert({
      user_id: stateRow.user_id,
      provider: "onedrive",
      access_kind: accessKind,
      token_ciphertext: tokenCiphertext,
      scopes: token.scope ? token.scope.split(" ") : [],
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (tokenStoreError) {
      return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "token_store_failed"));
    }

    if (!skipProjectMutation && project) {
      const { error: projectUpdateError } = await service
        .from("projects")
        .update({
          dochub_enabled: true,
          dochub_provider: "onedrive",
          dochub_mode: stateRow.mode,
          dochub_status: "connected",
          dochub_last_error: null,
        })
        .eq("id", stateRow.project_id);
      if (projectUpdateError) {
        return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", "project_update_failed"));
      }
    }

    const returnTo = sanitizeReturnTo(stateRow.return_to);
    return redirect(req, returnTo);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return redirect(req, withQueryParam(defaultReturnTo(), "dochub_error", message));
  }
});
