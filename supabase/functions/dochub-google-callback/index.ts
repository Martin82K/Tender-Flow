import { corsHeaders } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Provider = "gdrive";

const siteUrl = () => Deno.env.get("SITE_URL") || "http://localhost:5173";

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

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const returnTo = await tryResolveReturnTo(state);
      return redirect(withQueryParam(returnTo || `${siteUrl()}/?dochub=1`, "dochub_error", error));
    }
    if (!code || !state) {
      return redirect(`${siteUrl()}/?dochub_error=missing_code_or_state`);
    }

    const [provider, nonce] = state.split(".", 2);
    if (provider !== "gdrive" || !nonce) {
      return redirect(`${siteUrl()}/?dochub_error=invalid_state`);
    }

    const service = createServiceClient();
    const { data: stateRow, error: stateError } = await service
      .from("dochub_oauth_states")
      .select("*")
      .eq("nonce", nonce)
      .eq("provider", provider as Provider)
      .single();

    if (stateError || !stateRow) {
      return redirect(`${siteUrl()}/?dochub_error=state_not_found`);
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
    const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") || "";
    const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");

    if (!clientId || !clientSecret || !redirectUri || !encKey) {
      return redirect(`${siteUrl()}/?dochub_error=missing_oauth_env`);
    }

    const token = await tokenExchangeGoogle({ code, clientId, clientSecret, redirectUri });
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

    // One-time state; cleanup
    await service.from("dochub_oauth_states").delete().eq("id", stateRow.id);

    const returnTo = stateRow.return_to || `${siteUrl()}/?dochub=1`;
    return redirect(returnTo);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return redirect(`${siteUrl()}/?dochub_error=${encodeURIComponent(message)}`);
  }
});
