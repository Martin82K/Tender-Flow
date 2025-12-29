import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type Provider = "gdrive" | "onedrive";
type Mode = "user" | "org";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const randomNonce = () => crypto.randomUUID().replaceAll("-", "");

const getSiteUrl = (): string =>
  Deno.env.get("SITE_URL") || "http://localhost:5173";

const getProjectRef = (): string | null => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  try {
    const host = new URL(supabaseUrl).host; // <ref>.supabase.co
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
};

const normalizeRedirectUri = (raw: string | null, fallbackPath: string): string => {
  const val = (raw || "").trim();
  const ref = getProjectRef();
  const fallback = ref ? `https://${ref}.functions.supabase.co/${fallbackPath}` : "";

  if (!val) return fallback;

  // If someone configured the gateway form (`https://<ref>.supabase.co/functions/v1/<fn>`),
  // Google will redirect there without headers and it will 401. Rewrite it.
  if (val.includes(".supabase.co/functions/v1/")) {
    return val.replace(".supabase.co/functions/v1/", ".functions.supabase.co/");
  }

  return val;
};

const buildGoogleAuthUrl = (args: {
  clientId: string;
  redirectUri: string;
  state: string;
}) => {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      // Use drive.file to avoid Google verification requirements for full Drive access.
      // Root folder selection is done via Google Picker (user-driven access grant).
      "https://www.googleapis.com/auth/drive.file",
      "openid",
      "email",
      "profile",
    ].join(" ")
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", args.state);
  return url.toString();
};

const buildMicrosoftAuthUrl = (args: {
  clientId: string;
  redirectUri: string;
  state: string;
}) => {
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "offline_access",
      "User.Read",
      "Files.ReadWrite",
      "Sites.ReadWrite.All",
    ].join(" ")
  );
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("state", args.state);
  return url.toString();
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const provider = (body?.provider as Provider) || null;
    const mode = (body?.mode as Mode) || null;
    const projectId = (body?.projectId as string) || null;
    const returnTo = (body?.returnTo as string) || `${getSiteUrl()}/?dochub=1`;

    if (!provider || !["gdrive", "onedrive"].includes(provider)) {
      return json(400, { error: "Invalid provider" });
    }
    if (!mode || !["user", "org"].includes(mode)) {
      return json(400, { error: "Invalid mode" });
    }
    if (!projectId) {
      return json(400, { error: "Missing projectId" });
    }

    const nonce = randomNonce();
    const state = `${provider}.${nonce}`;

    const service = createServiceClient();
    const { error: insertError } = await service.from("dochub_oauth_states").insert({
      nonce,
      provider,
      user_id: userData.user.id,
      project_id: projectId,
      mode,
      return_to: returnTo,
    });
    if (insertError) return json(500, { error: insertError.message });

    if (provider === "gdrive") {
      const clientId =
        Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ||
        // Back-compat for a common typo in local envs
        Deno.env.get("GOOGL_OAUTH_CLIENT_ID") ||
        "";
      const redirectUri = normalizeRedirectUri(
        Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI"),
        "dochub-google-callback"
      );
      if (!clientId || !redirectUri) {
        return json(500, { error: "Missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_REDIRECT_URI" });
      }
      return json(200, { url: buildGoogleAuthUrl({ clientId, redirectUri, state }) });
    }

    const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
    const redirectUri = normalizeRedirectUri(
      Deno.env.get("MS_OAUTH_REDIRECT_URI"),
      "dochub-microsoft-callback"
    );
    if (!clientId || !redirectUri) {
      return json(500, { error: "Missing MS_OAUTH_CLIENT_ID/MS_OAUTH_REDIRECT_URI" });
    }
    return json(200, { url: buildMicrosoftAuthUrl({ clientId, redirectUri, state }) });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
