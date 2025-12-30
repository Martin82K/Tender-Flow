import { corsHeaders } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Provider = "onedrive";

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
  new Response(null, { status: 302, headers: { ...corsHeaders, location: to } });

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
}) => {
  const body = new URLSearchParams();
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  body.set("code", args.code);
  body.set("redirect_uri", args.redirectUri);
  body.set("grant_type", "authorization_code");
  body.set(
    "scope",
    ["offline_access", "User.Read", "Files.ReadWrite", "Sites.ReadWrite.All"].join(" ")
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
      return redirect(to);
    }
    if (!code || !state) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "missing_code_or_state"));
    }

    const [provider, nonce] = state.split(".", 2);
    if (provider !== "onedrive" || !nonce) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "invalid_state"));
    }

    const service = createServiceClient();
    const { data: stateRow, error: stateError } = await service
      .from("dochub_oauth_states")
      .select("*")
      .eq("nonce", nonce)
      .eq("provider", provider as Provider)
      .single();

    if (stateError || !stateRow) {
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "state_not_found"));
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
      return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "missing_oauth_env"));
    }

    const token = await tokenExchangeMicrosoft({ code, clientId, clientSecret, redirectUri, tenant });
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const tokenCiphertext = await encryptJsonAesGcm(
      {
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        scope: token.scope || null,
        token_type: token.token_type,
      },
      encKey
    );

    await service.from("dochub_user_tokens").upsert({
      user_id: stateRow.user_id,
      provider: "onedrive",
      token_ciphertext: tokenCiphertext,
      scopes: token.scope ? token.scope.split(" ") : [],
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "onedrive",
        dochub_mode: stateRow.mode,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", stateRow.project_id);

    await service.from("dochub_oauth_states").delete().eq("id", stateRow.id);

    const returnTo = sanitizeReturnTo(stateRow.return_to);
    return redirect(returnTo);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return redirect(withQueryParam(defaultReturnTo(), "dochub_error", message));
  }
});
