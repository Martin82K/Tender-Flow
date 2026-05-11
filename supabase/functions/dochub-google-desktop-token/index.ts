import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type Mode = "user" | "org";
type ProviderIdentity = {
  audience: string;
  email: string;
  emailVerified: boolean | null;
  subjects: string[];
};
type VerifiedGoogleToken = ProviderIdentity & {
  expiresIn: number;
  scopes: string[];
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

const REQUIRED_GOOGLE_SCOPES = new Set(["https://www.googleapis.com/auth/drive.file"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

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

const getAllowedGoogleClientIds = (): string[] =>
  [
    Deno.env.get("GOOGLE_OAUTH_CLIENT_ID_DESKTOP"),
    Deno.env.get("GOOGLE_DESKTOP_OAUTH_CLIENT_ID"),
    Deno.env.get("VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP"),
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);

const collectExpectedGoogleIdentity = (user: SupabaseAuthUser) => {
  const emails = new Set<string>();
  const subjects = new Set<string>();
  const userEmail = normalizeEmail(user.email);
  if (userEmail) emails.add(userEmail);

  for (const identity of user.identities || []) {
    if (identity.provider !== "google") continue;
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
  allowedClientIds: string[];
}) => {
  if (!args.allowedClientIds.includes(args.identity.audience)) {
    throw new Error("Google token audience mismatch");
  }
  if (!args.identity.email || args.identity.subjects.length === 0) {
    throw new Error("Google token identity missing");
  }
  if (args.identity.emailVerified === false) {
    throw new Error("Google token email not verified");
  }

  const expected = collectExpectedGoogleIdentity(args.user);
  const emailMatch = expected.emails.has(normalizeEmail(args.identity.email));
  const subjectMatch = args.identity.subjects.some((subject) => expected.subjects.has(subject));

  if (!emailMatch && !subjectMatch) {
    throw new Error("Google token identity does not match signed-in user");
  }
};

const fetchGoogleAccessTokenInfo = async (accessToken: string): Promise<VerifiedGoogleToken> => {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description || body?.error || "Google token verification failed");

  const scopes = String(body.scope || "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const missingScope = Array.from(REQUIRED_GOOGLE_SCOPES).find((scope) => !scopes.includes(scope));
  if (missingScope) {
    throw new Error("Google token missing required Drive scope");
  }

  const expiresIn = Number(body.expires_in || 0);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Google token expired");
  }

  const subject = normalizeSubject(body.sub || body.user_id);
  return {
    audience: String(body.aud || body.audience || body.issued_to || ""),
    email: normalizeEmail(body.email),
    emailVerified: booleanClaim(body.email_verified || body.verified_email),
    subjects: subject ? [subject] : [],
    expiresIn,
    scopes,
  };
};

const fetchGoogleUserInfo = async (accessToken: string): Promise<ProviderIdentity> => {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description || body?.error || "Google userinfo verification failed");

  const subject = normalizeSubject(body.sub);
  return {
    audience: "",
    email: normalizeEmail(body.email),
    emailVerified: booleanClaim(body.email_verified),
    subjects: subject ? [subject] : [],
  };
};

const assertSameGoogleIdentity = (current: ProviderIdentity, refreshed: ProviderIdentity) => {
  const sameAudience = current.audience === refreshed.audience;
  const sameEmail = normalizeEmail(current.email) === normalizeEmail(refreshed.email);
  const sameSubject = current.subjects.some((subject) => refreshed.subjects.includes(subject));

  if (!sameAudience || !sameEmail || !sameSubject) {
    throw new Error("Google refresh token identity mismatch");
  }
};

const verifyGoogleDesktopToken = async (args: {
  accessToken: string;
  user: SupabaseAuthUser;
}): Promise<VerifiedGoogleToken> => {
  const allowedClientIds = getAllowedGoogleClientIds();
  if (allowedClientIds.length === 0) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID_DESKTOP");
  }

  const tokenInfo = await fetchGoogleAccessTokenInfo(args.accessToken);
  const userInfo = await fetchGoogleUserInfo(args.accessToken);
  if (
    tokenInfo.subjects[0] &&
    userInfo.subjects[0] &&
    tokenInfo.subjects[0] !== userInfo.subjects[0]
  ) {
    throw new Error("Google token/userinfo subject mismatch");
  }
  if (tokenInfo.email && userInfo.email && tokenInfo.email !== userInfo.email) {
    throw new Error("Google token/userinfo email mismatch");
  }

  const verified = {
    ...tokenInfo,
    email: tokenInfo.email || userInfo.email,
    emailVerified: tokenInfo.emailVerified ?? userInfo.emailVerified,
    subjects: Array.from(new Set([...tokenInfo.subjects, ...userInfo.subjects])),
  };
  assertIdentityBoundToUser({
    identity: verified,
    user: args.user,
    allowedClientIds,
  });
  return verified;
};

const refreshGoogleDesktopToken = async (args: {
  refreshToken: string;
  clientId: string;
}) => {
  const body = new URLSearchParams();
  body.set("refresh_token", args.refreshToken);
  body.set("client_id", args.clientId);
  body.set("grant_type", "refresh_token");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const jsonBody = await res.json();
  if (!res.ok) throw new Error(jsonBody?.error_description || "Google refresh token verification failed");
  return jsonBody as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const projectId = (body?.projectId as string) || "";
    const mode = (body?.mode as Mode) || null;
    const token = body?.token as {
      accessToken?: string;
      refreshToken?: string | null;
      scope?: string | null;
      tokenType?: string;
      expiresIn?: number;
      clientId?: string | null;
    } | null;

    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!mode || !["user", "org"].includes(mode)) {
      return json(400, { error: "Invalid mode" });
    }
    if (!token?.accessToken || !token?.tokenType || !token?.expiresIn) {
      return json(400, { error: "Missing token data" });
    }
    if (token.tokenType.toLowerCase() !== "bearer") {
      return json(400, { error: "Invalid token type" });
    }

    const { data: project, error: projectError } = await authed
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json(403, { error: "No access to project" });

    let canUpdateProject = project.owner_id === null || project.owner_id === userData.user.id;
    if (!canUpdateProject) {
      const { data: hasEditPermission, error: editPermissionError } = await authed.rpc(
        "has_project_share_permission",
        {
          p_id: projectId,
          u_id: userData.user.id,
          required_permission: "edit",
        }
      );
      if (editPermissionError) return json(403, { error: "No edit access to project" });
      canUpdateProject = Boolean(hasEditPermission);
    }

    if (!canUpdateProject) return json(403, { error: "No edit access to project" });

    const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");
    if (!encKey) return json(500, { error: "Missing DOCHUB_TOKEN_ENCRYPTION_KEY" });

    const user = userData.user as SupabaseAuthUser;
    let accessTokenToStore = token.accessToken;
    let tokenTypeToStore = token.tokenType;
    let verifiedToken = await verifyGoogleDesktopToken({
      accessToken: token.accessToken,
      user,
    });

    if (token.refreshToken) {
      const refreshed = await refreshGoogleDesktopToken({
        refreshToken: token.refreshToken,
        clientId: verifiedToken.audience,
      });
      const refreshedIdentity = await verifyGoogleDesktopToken({
        accessToken: refreshed.access_token,
        user,
      });
      assertSameGoogleIdentity(verifiedToken, refreshedIdentity);
      accessTokenToStore = refreshed.access_token;
      tokenTypeToStore = refreshed.token_type || token.tokenType;
      verifiedToken = refreshedIdentity;
    }

    const expiresAt = new Date(Date.now() + verifiedToken.expiresIn * 1000).toISOString();
    const tokenCiphertext = await encryptJsonAesGcm(
      {
        access_token: accessTokenToStore,
        refresh_token: token.refreshToken || null,
        scope: verifiedToken.scopes.join(" "),
        token_type: tokenTypeToStore,
        client_id: verifiedToken.audience,
        client_type: "desktop",
        provider_subject: verifiedToken.subjects[0] || null,
        provider_email: verifiedToken.email,
        provider_audience: verifiedToken.audience,
      },
      encKey
    );

    const service = createServiceClient();
    await service.from("dochub_user_tokens").upsert({
      user_id: userData.user.id,
      provider: "gdrive",
      token_ciphertext: tokenCiphertext,
      scopes: verifiedToken.scopes,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "gdrive",
        dochub_mode: mode,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", projectId);

    return json(200, { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: message });
  }
});
