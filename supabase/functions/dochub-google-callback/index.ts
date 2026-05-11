import { buildCorsHeaders } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Provider = "gdrive";
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

const siteBaseUrl = () => {
  const raw = (Deno.env.get("SITE_URL") || "http://localhost:3000").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
};

const defaultReturnTo = () => `${siteBaseUrl()}/app?dochub=1`;

const redirect = (to: string) =>
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
  if (provider !== "gdrive" || !nonce) return null;

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

const tokenExchangeGoogle = async (args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) => {
  const body = new URLSearchParams();
  body.set("code", args.code);
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  body.set("redirect_uri", args.redirectUri);
  body.set("grant_type", "authorization_code");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || "Google token exchange failed");
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

const booleanClaim = (value: unknown): boolean | null => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const collectExpectedIdentity = (user: SupabaseAuthUser, provider: "google") => {
  const emails = new Set<string>();
  const subjects = new Set<string>();
  const userEmail = normalizeEmail(user.email);
  if (userEmail) emails.add(userEmail);

  for (const identity of user.identities || []) {
    if (identity.provider !== provider) continue;
    const data = identity.identity_data || {};
    const identityEmail = normalizeEmail(data.email);
    if (identityEmail) emails.add(identityEmail);

    for (const candidate of [identity.provider_id, identity.id, data.sub, data.provider_id]) {
      const subject = normalizeSubject(candidate);
      if (subject) subjects.add(subject);
    }
  }

  return { emails, subjects };
};

const assertIdentityBoundToUser = (args: {
  identity: ProviderIdentity;
  user: SupabaseAuthUser;
  provider: "google";
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

  const expected = collectExpectedIdentity(args.user, args.provider);
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

const fetchGoogleTokenInfo = async (idToken: string): Promise<ProviderIdentity> => {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", idToken);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || json?.error || "Google id_token verification failed");

  const subject = normalizeSubject(json.sub);
  const email = normalizeEmail(json.email);
  return {
    audience: String(json.aud || ""),
    email,
    emailVerified: booleanClaim(json.email_verified),
    subjects: subject ? [subject] : [],
  };
};

const fetchGoogleUserInfo = async (accessToken: string): Promise<ProviderIdentity> => {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || json?.error || "Google userinfo verification failed");

  const subject = normalizeSubject(json.sub);
  const email = normalizeEmail(json.email);
  return {
    audience: "",
    email,
    emailVerified: booleanClaim(json.email_verified),
    subjects: subject ? [subject] : [],
  };
};

const verifyGoogleIdentity = async (args: {
  token: Awaited<ReturnType<typeof tokenExchangeGoogle>>;
  clientId: string;
  user: SupabaseAuthUser;
}): Promise<ProviderIdentity> => {
  if (!args.token.id_token) {
    throw new Error("Missing Google id_token");
  }

  const tokenInfo = await fetchGoogleTokenInfo(args.token.id_token);
  const userInfo = await fetchGoogleUserInfo(args.token.access_token);
  if (
    tokenInfo.subjects[0] &&
    userInfo.subjects[0] &&
    tokenInfo.subjects[0] !== userInfo.subjects[0]
  ) {
    throw new Error("Google id_token/userinfo subject mismatch");
  }
  if (tokenInfo.email && userInfo.email && tokenInfo.email !== userInfo.email) {
    throw new Error("Google id_token/userinfo email mismatch");
  }

  const identity = {
    ...tokenInfo,
    email: tokenInfo.email || userInfo.email,
    emailVerified: tokenInfo.emailVerified ?? userInfo.emailVerified,
    subjects: Array.from(new Set([...tokenInfo.subjects, ...userInfo.subjects])),
  };
  assertIdentityBoundToUser({
    identity,
    user: args.user,
    provider: "google",
    clientId: args.clientId,
  });
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

    if (error) {
      const returnTo = await tryResolveReturnTo(state);
      const to = withQueryParam(sanitizeReturnTo(returnTo), "dochub_error", error);
      return redirect(to);
    }
    if (!code || !state) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "missing_code_or_state"));
    }

    const [provider, nonce] = state.split(".", 2);
    if (provider !== "gdrive" || !nonce) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "invalid_state"));
    }

    const service = createServiceClient();
    const stateRow = await consumeFreshOAuthState({
      service,
      nonce,
      provider: provider as Provider,
    });

    if (!stateRow) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "state_not_found_or_expired"));
    }

    const { data: project, error: projectAccessError } = await service
      .from("projects")
      .select("id, owner_id")
      .eq("id", stateRow.project_id)
      .maybeSingle();
    if (projectAccessError || !project) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));
    }

    if (project.owner_id !== stateRow.user_id) {
      const { data: share } = await service
        .from("project_shares")
        .select("id")
        .eq("project_id", stateRow.project_id)
        .eq("user_id", stateRow.user_id)
        .eq("permission", "edit")
        .maybeSingle();
      if (!share) {
        return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));
      }
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
    const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") || "";
    const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");

    if (!clientId || !clientSecret || !redirectUri || !encKey) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "missing_oauth_env"));
    }

    const token = await tokenExchangeGoogle({ code, clientId, clientSecret, redirectUri });
    const stateUser = await getStateUser(service, stateRow.user_id);
    const providerIdentity = await verifyGoogleIdentity({ token, clientId, user: stateUser });
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

    await service.from("dochub_user_tokens").upsert({
      user_id: stateRow.user_id,
      provider: "gdrive",
      token_ciphertext: tokenCiphertext,
      scopes: token.scope ? token.scope.split(" ") : [],
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "gdrive",
        dochub_mode: stateRow.mode,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", stateRow.project_id);

    const returnTo = sanitizeReturnTo(stateRow.return_to);
    return redirect(returnTo);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return redirect(withQueryParam(defaultReturnTo(), "dochub_error", message));
  }
});
