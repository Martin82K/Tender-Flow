import { createServiceClient } from "./supabase.ts";
import { encryptJsonAesGcm, tryGetEnv } from "./crypto.ts";

type Provider = "gdrive" | "onedrive";

const b64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToText = (bytes: ArrayBuffer): string => new TextDecoder().decode(bytes);

const decryptJsonAesGcm = async <T>(
  ciphertext: string,
  base64Key: string
): Promise<T> => {
  const [ivB64, dataB64] = ciphertext.split(".", 2);
  if (!ivB64 || !dataB64) throw new Error("Invalid ciphertext format");

  const keyBytes = b64ToBytes(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("DOCHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes base64");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = b64ToBytes(ivB64);
  const data = b64ToBytes(dataB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(bytesToText(plaintext)) as T;
};

const refreshGoogle = async (args: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string | null;
}) => {
  const body = new URLSearchParams();
  body.set("client_id", args.clientId);
  if (args.clientSecret) {
    body.set("client_secret", args.clientSecret);
  }
  body.set("refresh_token", args.refreshToken);
  body.set("grant_type", "refresh_token");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || "Google refresh failed");
  return json as { access_token: string; expires_in: number; scope?: string; token_type: string };
};

const refreshMicrosoft = async (args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) => {
  const body = new URLSearchParams();
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  body.set("refresh_token", args.refreshToken);
  body.set("redirect_uri", args.redirectUri);
  body.set("grant_type", "refresh_token");
  body.set(
    "scope",
    ["offline_access", "User.Read", "Files.ReadWrite", "Sites.ReadWrite.All"].join(" ")
  );

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || "Microsoft refresh failed");
  return json as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type: string;
  };
};

export const getAccessTokenForUser = async (args: {
  userId: string;
  provider: Provider;
}): Promise<{ accessToken: string; provider: Provider }> => {
  const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");
  if (!encKey) throw new Error("Missing DOCHUB_TOKEN_ENCRYPTION_KEY");

  const service = createServiceClient();
  const { data, error } = await service
    .from("dochub_user_tokens")
    .select("*")
    .eq("user_id", args.userId)
    .eq("provider", args.provider)
    .single();

  if (error || !data) throw new Error("Token not found");

  const token = await decryptJsonAesGcm<{
    access_token: string;
    refresh_token: string | null;
    scope: string | null;
    token_type: string;
    client_id?: string | null;
    client_type?: "web" | "desktop" | null;
  }>(data.token_ciphertext, encKey);

  const now = Date.now();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const isExpiring = expiresAt > 0 && expiresAt - now < 60_000;

  if (!isExpiring) {
    return { accessToken: token.access_token, provider: args.provider };
  }

  if (!token.refresh_token) throw new Error("Missing refresh_token");

  if (args.provider === "gdrive") {
    const clientId =
      (token.client_id && token.client_id.trim()) ||
      Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ||
      "";
    const clientSecret =
      token.client_type === "desktop"
        ? ""
        : Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
    if (!clientId) throw new Error("Missing Google OAuth client_id");

    const refreshed = await refreshGoogle({
      refreshToken: token.refresh_token,
      clientId,
      clientSecret,
    });

    const newToken = {
      access_token: refreshed.access_token,
      refresh_token: token.refresh_token,
      scope: refreshed.scope || token.scope,
      token_type: token.token_type,
      client_id: token.client_id || null,
      client_type: token.client_type || null,
    };

    const tokenCiphertext = await encryptJsonAesGcm(newToken, encKey);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await service.from("dochub_user_tokens").upsert({
      user_id: args.userId,
      provider: args.provider,
      token_ciphertext: tokenCiphertext,
      scopes: (newToken.scope || "").split(" ").filter(Boolean),
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    });

    return { accessToken: newToken.access_token, provider: args.provider };
  }

  const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("MS_OAUTH_CLIENT_SECRET") || "";
  const redirectUri = Deno.env.get("MS_OAUTH_REDIRECT_URI") || "";
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Missing Microsoft OAuth env");

  const refreshed = await refreshMicrosoft({
    refreshToken: token.refresh_token,
    clientId,
    clientSecret,
    redirectUri,
  });

  const newToken = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || token.refresh_token,
    scope: refreshed.scope || token.scope,
    token_type: token.token_type,
  };

  const tokenCiphertext = await encryptJsonAesGcm(newToken, encKey);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await service.from("dochub_user_tokens").upsert({
    user_id: args.userId,
    provider: args.provider,
    token_ciphertext: tokenCiphertext,
    scopes: (newToken.scope || "").split(" ").filter(Boolean),
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });

  return { accessToken: newToken.access_token, provider: args.provider };
};
